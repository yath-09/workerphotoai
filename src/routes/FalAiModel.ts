import { fal } from "@fal-ai/client";

export class FalAiModel{
    constructor(){
        
    }

    public async generateModelThumbnail(tensorPath: string) {
        const response = await fal.subscribe("fal-ai/flux-lora", {
            input: {
                prompt: "Generate a thumbnail version of the model-generated image with a clear, high-contrast background.",
                loras: [{ path: tensorPath, scale: 1 }]
            },
        })
        return {
          imageUrl: response.data.images[0].url
        }
    }
    
}

