const {defineSecret} = require("firebase-functions/params");
const functions = require("firebase-functions");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const cors = require("cors");

const corsHandler = cors({origin: true});

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const DEEPGRAM_API_KEY = defineSecret("DEEPGRAM_API_KEY");


exports.transcribeAudio = functions.https.onRequest(
    {secrets: [DEEPGRAM_API_KEY]},
    (req, res) => {
      corsHandler(req, res, async () => {
        try {
          if (!req.rawBody) {
            return res.status(400).send("No audio data");
          }
          const deepgramApiUrl = "https://api.deepgram.com/v1/listen";

          const response = await fetch(deepgramApiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
              "Content-Type": "audio/wav",
            },
            body: req.rawBody,
          });

          const data = await response.json();
          const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

          res.status(200).send({transcript});
        } catch (error) {
          console.error("Deepgram request failed:", error);
          res.status(500).send({error: "Failed to transcribe audio"});
        }
      });
    },
);

function buildSystemPrompt({topics = [], documentReferences = [], tasks = []}) {
  const summary = [];

  if (topics.length) {
    summary.push(`The user has discussed the following topics: ${topics.join(", ")}.`);
  }

  if (documentReferences.length) {
    summary.push(`They have referenced documents such as: ${documentReferences.join(", ")}.`);
  }

  if (tasks.length) {
    const taskDescriptions = tasks.map((t) => {
      const status = t.status || "pending";
      if (status != "completed") {
        switch (t.type) {
          case "send_invoice":
            return `send invoice ${t.document || ""} [${status}]`;
          case "view_invoice":
            return `view invoice ${t.document || ""} [${status}]`;
          case "check_order_status":
            return `check order status for ${t.order || ""} [${status}]`;
          case "reset_password":
            return `reset password [${status}]`;
          default:
            return `${t.type} [${status}]`;
        }
      }
    });
    summary.push(`Outstanding tasks: ${taskDescriptions.join("; ")}.`);
  }

  console.log("[SYSTEM CONTEXT]", {topics, documentReferences, tasks});

  return `
        You are a helpful customer service assistant. 
        This is a structured summary of the conversation so far:
        ${summary.join("\n")}
        
        Use this information to respond intelligently.
        Avoid asking for details the user has already given.
        You will not need to get any further information, most of responses are hard coded anyway.
        Try to respond to things like "I need help resetting my password" with "Okay, just give me one moment and I can help you 
        reset your password" or "I need you to send me a copy of invoice 275" with "Okay, just me me a moment while I look that up for you and send it 
        to the email on file".  Additionally, there is no need to specify the type of documents being sent. For example, if the user says "Can you send me invoice number 275?" the
        response should be "Sure, I will send invoice_275.pdf to the email on file".  Make sure you don't forget to reference other tasks left as well.  Here would be an example of a perfect response:

        User: can you send invoice 275 to the email on file and tell me the order status of order number 275 as well"

        Response: Sure, I will send the invoice_275.pdf to the email on file. Let me check the status for order 275 as well.
  `;
}


exports.processMessage = functions.https.onRequest(
    {secrets: [OPENAI_API_KEY]},
    (req, res) => {
      corsHandler(req, res, async () => {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const {message, chatLog, state = {}} = req.body;
        const {
          topics: sessionTopics = [],
          documents: sessionDocuments = [],
          tasks: sessionTasks = [],
        } = state;

        if (!message || !Array.isArray(chatLog)) {
          return res.status(400).send({error: "Missing or invalid message or chatLog"});
        }

        const formattedChat = chatLog.map((entry) => ({
          role: entry.sender === "user" ? "user" : "assistant",
          content: entry.text,
        }));

        try {
          // STEP 1: Run analysis (topics + document refs)
          const analysisResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `
                You are an assistant that extracts structured metadata from customer service messages.
                Return a JSON object with two fields:
                
                {
                "topics": [string],
                "document_references": [string]
                }

                Valid topics include: Password Reset, Order Status Inquiry, Viewing an Invoice, Sending an Invoice,
                 General Inquiry

                Use only the exact valid topic names and ensure you choose the one that fits best.
                
                Document references have the following formats:
                - Orders: order_{number}.pdf
                - Invoices: invoice_{id}.pdf

                If a generic document form is referenced (i.e. "I need help with an order") do not store it as a document reference unless 
                the details of the document are provided, such as an order number. Treat it as if no document was found or mentioned until
                a specific one is referenced.

                If no topics or documents are found, return empty arrays. 
                Do NOT explain. Just return the JSON object.`,
              },
              ...formattedChat,
              {role: "user", content: message},
            ],
            temperature: 0.2,
          });

          let analysisData;
          try {
            analysisData = JSON.parse(analysisResponse.choices[0].message.content.trim());
          } catch (err) {
            console.error("Failed to parse analysis response:", analysisResponse.choices[0].message.content);
            return res.status(500).send({error: "Invalid JSON from analysis step"});
          }

          console.log("[ANALYSIS DATA]", analysisData);

          const newTopics = Array.isArray(analysisData.topics) ? analysisData.topics : [];
          const newDocuments = Array.isArray(analysisData.document_references) ? analysisData.document_references : [];

          const mergedTopics = Array.from(new Set([...sessionTopics, ...newTopics]));
          const mergedDocuments = Array.from(new Set([...sessionDocuments, ...newDocuments]));

          console.log("[MERGED TOPICS]", mergedTopics);


          // STEP 2: Task extraction
          const taskExtractionResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `
                You are an assistant that extracts structured task intents from customer service messages.
                
                Return a single JSON object with one field:

                Example response:
                    {
                    "tasks": [
                        { "type": "send_invoice", "document": "invoice_275.pdf", "status": "pending" },
                        { "type": "check_order_status", "order": "order_275", "status": "pending" }
                    ]
                    }

                Valid task types are:
                send_invoice, check_order_status, and reset_password

                Only return clearly requested tasks. If no task is present, return:
                { "tasks": [] }

                Ensure tasks are in the order in which they are stated.

                All tasks should be contain "status" and it should always be initialized to "pending".

                Do not include markdown formatting. Do not explain.`,
              },
              {role: "user", content: message},
            ],
            temperature: 0.3,
          });

          let taskData;
          try {
            const raw = taskExtractionResponse.choices[0].message.content.trim();
            const parsed = JSON.parse(raw);

            if (parsed && Array.isArray(parsed.tasks)) {
              taskData = parsed.tasks;
            } else {
              console.warn("Parsed JSON did not contain a tasks array:", parsed);
            }
          } catch (err) {
            console.error("Failed to parse task extraction response:", taskExtractionResponse.choices[0].message.content);
            return res.status(500).send({error: "Invalid JSON from task step"});
          }


          const mergedTasks = [...sessionTasks, ...taskData];


          // STEP 3: Generate assistant response with context

          const systemPrompt = buildSystemPrompt({
            topics: mergedTopics,
            documentReferences: mergedDocuments,
            tasks: mergedTasks,
          });

          const fullMessages = [
            {role: "system", content: systemPrompt},
            ...formattedChat,
            {role: "user", content: message},
          ];


          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: fullMessages,
            temperature: 0.7,
          });

          const assistantReply = response.choices[0].message.content.trim();

          // Send results back
          return res.status(200).send({
            assistantReply,
            topics: mergedTopics,
            document_references: mergedDocuments,
            tasks: mergedTasks,
          });
        } catch (error) {
          console.error("Error in processMessage:", error);
          return res.status(500).send({error: "Processing failed"});
        }
      });
    },
);

