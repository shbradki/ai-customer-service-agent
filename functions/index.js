/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

require('dotenv').config()

const functions = require('firebase-functions');
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
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // or 'gpt-4' if you want more power (and cost)
        messages: [
          { role: 'system', content: 'You are a helpful customer service agent for a company. Respond politely and clearly to user questions.' },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      });
  
      const assistantReply = response.choices[0].message.content.trim();
      res.status(200).send({ reply: assistantReply });
    } catch (error) {
      console.error('OpenAI request failed:', error);
      res.status(500).send({ reply: "I'm having trouble responding right now. Please try again later." });
    }
  });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
