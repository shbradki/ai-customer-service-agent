require('dotenv').config();
const functions = require('firebase-functions');
const fetch = require('node-fetch');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.chatWithAssistant = functions.https.onRequest(async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).send({ error: 'No message provided.' });
  }

  try {
    const formattedMessages = [
        {
          role: 'system',
          content: `You are a helpful customer service agent. You have already greeted the user.
            Be concise, avoid repeating yourself, and remember any details the user gives you (like order numbers).
            Reference earlier messages if relevant.`,
        },
        ...chatLog.map(entry => ({
          role: entry.sender === 'user' ? 'user' : 'assistant',
          content: entry.text,
        })),
        {
          role: 'user',
          content: message,
        },
      ];
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: formattedMessages,
      temperature: 0.7,
    });

    const assistantReply = response.choices[0].message.content.trim();
    res.status(200).send({ reply: assistantReply });
  } catch (error) {
    console.error('OpenAI request failed:', error);
    res.status(500).send({ reply: "I'm having trouble responding right now. Please try again later." });
  }
});

exports.transcribeAudio = functions.https.onRequest(async (req, res) => {
  try {
    if (!req.rawBody) {
      return res.status(400).send('No audio data');
    }

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    const deepgramApiUrl = 'https://api.deepgram.com/v1/listen';

    const response = await fetch(deepgramApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: req.rawBody,
    });

    const data = await response.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    res.status(200).send({ transcript });
  } catch (error) {
    console.error('Deepgram request failed:', error);
    res.status(500).send({ error: 'Failed to transcribe audio' });
  }
});

// exports.summarizeChat = functions.https.onRequest(async (req, res) => {
//     const { chatLog } = req.body;
  
//     if (!chatLog || !Array.isArray(chatLog)) {
//       return res.status(400).send({ error: 'Missing or invalid chatLog' });
//     }
  
//     try {
//       const messages = [
//         {
//           role: 'system',
//           content: `Given the following chat conversation, determine which category from the list best fits the inquiry: 

//                     Customer Service Categories: Account Creation/Registration, Password Reset, Login Issues, Order Status 
//                     Inquiry, Product Information, Shipping and Delivery Tracking, Returns and Exchanges, Invoice Inquiry, 
//                     Billing and Payment Issues, Subscription Management, Account Update, Technical Support, Troubleshooting Issues, 
//                     Product Warranty Information, Refund Request, Discounts and Promotions, Cancellation of Orders or Services, 
//                     Loyalty Program Assistance, Customer Feedback, Complaint Resolution, Store Locations and Hours, 
//                     Service Availability or Outages, Cancellation and Rescheduling of Appointments, FAQ Assistance, 
//                     Product Recommendations.
                    
//                     Your output should just be the category that it matches best and nothing more, ex. "Password Reset" or "Login Issues"`,
//         },
//         {
//           role: 'user',
//           content: chatLog.map(entry => `${entry.sender}: ${entry.text}`).join('\n'),
//         },
//       ];
  
//       const response = await openai.chat.completions.create({
//         model: 'gpt-3.5-turbo',
//         messages,
//         temperature: 0.2,
//       });
  
//       const summary = response.choices[0].message.content.trim();
//       res.status(200).send({ summary });
  
//     } catch (error) {
//       console.error('Error summarizing chat:', error);
//       res.status(500).send({ error: 'Failed to generate summary' });
//     }
//   });
  
exports.analyzeUserMessage = functions.https.onRequest(async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).send({ error: 'No message provided' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `
                You are an assistant that extracts structured metadata from customer service messages.
                
                Return a JSON object with two fields:
                
                {
                    "topics": [string],               // List of categories the message relates to
                    "document_references": [string]   // Any document, order number, invoice IDs, or other specific file like those mentioned that may need to be referred to later
                }

                Valid topics include: Account Creation/Registration, Password Reset, Login Issues, Order Status Inquiry, 
                Product Information, Shipping and Delivery Tracking, Returns and Exchanges, Invoice Inquiry, 
                Billing and Payment Issues, Subscription Management, Account Update, Technical Support, Troubleshooting Issues, 
                Product Warranty Information, Refund Request, Discounts and Promotions, Cancellation of Orders or Services, 
                Loyalty Program Assistance, Customer Feedback, Complaint Resolution, Store Locations and Hours, 
                Service Availability or Outages, Cancellation and Rescheduling of Appointments, FAQ Assistance,
                Product Recommendations.
                
                Document references have the following formats:
                - Orders: order_{number}.pdf
                - Invoices: invoice_{id}.pdf

                If a generic document form is refered (i.e. "I need help with an order") do not store it as a document reference unless 
                the details of the document are provided, such as an order number.
                

                If no topic or document is found, return empty arrays. Do not explain your answer, just return the JSON object.

            `
                },
                { role: 'user', content: message }
            ],
            temperature: 0.2,
        });

        let parsed;
        try {
            parsed = JSON.parse(response.choices[0].message.content.trim());
          } catch (e) {
            console.error('Failed to parse GPT response:', response.choices[0].message.content);
            return res.status(500).send({ error: 'Invalid JSON from OpenAI' });
          }
      
          const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
          const documentReferences = Array.isArray(parsed.document_references) ? parsed.document_references : [];
        res.status(200).send({
            topics: topics,
            document_references: documentReferences
        });
    } catch (error) {
        console.error('Error analyzing message:', error);
        res.status(500).send({ error: 'Failed to analyze message' });
    }
});

exports.processMessage = functions.https.onRequest(async (req, res) => {
    const { message, chatLog } = req.body;
  
    if (!message || !Array.isArray(chatLog)) {
      return res.status(400).send({ error: 'Missing or invalid message or chatLog' });
    }
  
    try {
      // STEP 1: Run analysis (topics + document refs)
      const analysisResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
            You are an assistant that extracts structured metadata from customer service messages.
            Return a JSON object with two fields:
            {
              "topics": [string],
              "document_references": [string]
            }
            If no topics or documents are found, return empty arrays.
            Do NOT explain. Just return the JSON object.`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0.2,
      });
  
      let analysisData;
      try {
        analysisData = JSON.parse(analysisResponse.choices[0].message.content.trim());
      } catch (err) {
        console.error('Failed to parse analysis response:', analysisResponse.choices[0].message.content);
        return res.status(500).send({ error: 'Invalid JSON from analysis step' });
      }
  
      const topics = Array.isArray(analysisData.topics) ? analysisData.topics : [];
      const documentReferences = Array.isArray(analysisData.document_references) ? analysisData.document_references : [];
  
      // STEP 2: Generate assistant response (with context)
      const formattedChat = chatLog.map(entry => ({
        role: entry.sender === 'user' ? 'user' : 'assistant',
        content: entry.text,
      }));
  
      const fullMessages = [
        {
          role: 'system',
          content: `You are a helpful customer service agent. You have already greeted the user.
          Be concise, avoid repeating yourself, and remember any details the user gives you (like order numbers).
          Reference earlier messages if relevant.`,
        },
        ...formattedChat,
        { role: 'user', content: message },
      ];
  
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: fullMessages,
        temperature: 0.7,
      });
  
      const assistantReply = response.choices[0].message.content.trim();
  
      // Send combined results back
      return res.status(200).send({
        assistantReply,
        topics,
        document_references: documentReferences,
      });
  
    } catch (error) {
      console.error('Error in processMessage:', error);
      return res.status(500).send({ error: 'Processing failed' });
    }
  });
  