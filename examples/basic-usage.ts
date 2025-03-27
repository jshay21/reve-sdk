import { ReveAI, ReveAIError } from '../src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Example of using the Reve AI SDK to generate an image
 */
async function main() {
  // Create a new instance of the Reve AI SDK with authentication
  const reveAI = new ReveAI({
    auth: {
      authorization: 'Bearer your-jwt-token-here',
      cookie: 'your-cookie-value-here',
    },
    // Add your account's project ID, you can find it by generating an image on the Reve website and inspecting the network requests. It's the last part of the URL after /api/project/
    projectId: 'your-project-id-here',
    // Other optional configuration
    timeout: 60000,
    pollingInterval: 3000,
    verbose: true,
  });

  try {
    console.log('Generating image...');
    const result = await reveAI.generateImage({
      prompt: 'A serene mountain landscape with a lake at sunset, photorealistic style',
      width: 1024,
      height: 768,
      batchSize: 1,
      enhancePrompt: true,
    });

    console.log('Image generated successfully!');
    console.log(`Number of images: ${result.imageUrls.length}`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save all images as WebP files
    const savedFiles = result.imageUrls.map((base64Data, index) => {
      // Extract the base64 data (removing the data URL prefix if present)
      const base64Image = base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data;
      
      // Convert base64 to binary
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      // Generate a filename with timestamp to avoid overwriting
      const filename = `image_${Date.now()}_${index}.webp`;
      const filepath = path.join(outputDir, filename);
      
      // Save the file
      fs.writeFileSync(filepath, imageBuffer);
      
      return filepath;
    });
    
    // Log saved file paths
    savedFiles.forEach((filepath, index) => {
      console.log(`Image ${index + 1} saved to: ${filepath}`);
    });
    
    console.log(`Seed: ${result.seed}`);
    console.log(`Completed at: ${result.completedAt.toISOString()}`);
    console.log(`Prompt: ${result.prompt}`);
    
    if (result.negativePrompt) {
      console.log(`Negative prompt: ${result.negativePrompt}`);
    }
  } catch (error: unknown) {
    if (error instanceof ReveAIError) {
      console.error(`Reve AI Error (${error.type}): ${error.message}`);
      if (error.statusCode) {
        console.error(`Status code: ${error.statusCode}`);
      }
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Run the example
main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Unhandled error:', error.message);
  } else {
    console.error('Unknown unhandled error:', error);
  }
}); 