const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '');
    
    // Try the simple text model first
    console.log('Testing with gemini-pro...');
    const model1 = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result1 = await model1.generateContent('Hello world');
    console.log('SUCCESS with gemini-pro:', result1.response.text());
    
  } catch (error) {
    console.log('gemini-pro failed:', error.message);
    
    try {
      console.log('Testing with gemini-1.5-flash...');
      const model2 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result2 = await model2.generateContent('Hello world');
      console.log('SUCCESS with gemini-1.5-flash:', result2.response.text());
    } catch (error2) {
      console.log('gemini-1.5-flash failed:', error2.message);
      
      // List available models
      console.log('\nAPI Key starts with:', (process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '').substring(0, 10));
      console.log('Please check:');
      console.log('1. Your API key is valid');
      console.log('2. You have access to Gemini models');
      console.log('3. Your region allows Gemini API access');
    }
  }
}

testGemini();