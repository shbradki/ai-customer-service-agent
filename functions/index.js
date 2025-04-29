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
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
