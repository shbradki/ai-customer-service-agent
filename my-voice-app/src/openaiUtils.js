// import { OpenAI } from 'openai';

// // Initialize the OpenAI client
// const client = new OpenAI({
//   apiKey: ,  
// });

// // Function to send a message and get AI response
// export async function getAIResponse(userMessage) {
//   try {
//     const response = await client.responses.create({
//       model: 'gpt-3.5-turbo', 
//       instructions:  'You are a helpful customer service agent for a company. Answer user questions politely and clearly.',
//       input: userMessage,
//       temperature: 0.5, // Control creativity (0 = very literal, 1 = very creative)
//     });

//     return response.output_text;
//   } catch (error) {
//     console.error('Error contacting OpenAI:', error);
//     return "I'm having trouble responding right now. Please try again later.";
//   }
// }