import { Router } from 'express';
// Uncomment when ready to use Azure AI Foundry:
// import ModelClient from "@azure-rest/ai-inference";
// import { AzureKeyCredential } from "@azure/core-auth";

const router = Router();

// Azure AI Foundry configuration
// const AZURE_AI_ENDPOINT = process.env.AZURE_AI_ENDPOINT;
// const AZURE_AI_KEY = process.env.AZURE_AI_KEY;
// const MODEL_NAME = process.env.AZURE_AI_MODEL_NAME || "gpt-4o";

/**
 * Example endpoint for AI text generation
 * POST /api/ai/generate
 * Body: { prompt: string, maxTokens?: number }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, maxTokens = 1000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // TODO: Implement Azure AI Foundry call
    // Example implementation:
    // const client = ModelClient(AZURE_AI_ENDPOINT, new AzureKeyCredential(AZURE_AI_KEY));
    // const response = await client.path("/chat/completions").post({
    //   body: {
    //     model: MODEL_NAME,
    //     messages: [{ role: "user", content: prompt }],
    //     max_tokens: maxTokens,
    //   }
    // });
    // return res.json(response.body);

    // Placeholder response
    return res.json({
      message: 'AI endpoint ready for Azure AI Foundry integration',
      prompt,
    });
  } catch (error) {
    console.error('AI generation error:', error);
    return res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

/**
 * Example endpoint for streaming AI responses
 * POST /api/ai/stream
 * Body: { prompt: string }
 */
router.post('/stream', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // TODO: Implement Azure AI Foundry streaming
    // Example:
    // const client = ModelClient(AZURE_AI_ENDPOINT, new AzureKeyCredential(AZURE_AI_KEY));
    // const response = await client.path("/chat/completions").post({
    //   body: {
    //     model: MODEL_NAME,
    //     messages: [{ role: "user", content: prompt }],
    //     stream: true,
    //   }
    // });
    // for await (const chunk of response.body) {
    //   res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    // }
    // res.end();

    // Placeholder response
    res.write(`data: ${JSON.stringify({ message: 'Streaming ready for Azure AI Foundry' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('AI streaming error:', error);
    return res.status(500).json({ error: 'Failed to stream AI response' });
  }
});

export default router;
