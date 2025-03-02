import { PrismaClient } from "@prisma/client";

export const prismaClient = new PrismaClient();
import express from "express";
const router = express.Router();
import {fal} from '@fal-ai/client'
import { FalAiModel } from "./FalAiModel";
import { Webhook } from "svix";

router.post("/fal-ai/webhook/train", async (req, res) => {
    console.log("webhook received for /fal-ai/webhook/train")
    console.log(req.body);

    //this is the request id given by the falai when hitting our webhook
    const requestId = req.body.request_id as string;

    const result = await fal.queue.result("fal-ai/flux-lora", {
        requestId,
    });
    //creating the thumbnail for the model that is there 
    // const { imageUrl } = await FalAiModel.generateModelThumbnail(
    //     result.data?.diffusers_lora_file.url
    // );
    await prismaClient.model.updateMany({
        where: {
            falAiRequestId: requestId as string,
        },
        data: {
            tensorPath:(result.data as any)?.diffusers_lora_file?.url || "",
            thumbnail: "",
            trainingStatus: "GENERATED",
        }
    });
    res.status(200).json({
        message: "Webhook received",
    })
})


router.post("/fal-ai/webhook/image", async (req, res) => {
    console.log("REquest recived from falAi for image generation with the below response");
    console.log(req.body)
    const requestId = req.body.request_id;

    //if error comes from the falai 
    if (req.body.status == "ERROR") {
        res.status(411).json({});
        prismaClient.outputImages.updateMany({
            where: {
                falAiRequestId: requestId,
            },
            data: {
                status: "FAILED",
                imageUrl: req.body.payload.images[0].url,
            },
        });
        return;
    }
    //if sucesfull
    await prismaClient.outputImages.updateMany({
        where: {
            falAiRequestId: requestId as string,
        },
        data: {
            status: "GENERATED",
            imageUrl: req.body.payload.images[0].url,
        }
    })
    res.status(200).json({
        message: "Webhook received from the /image",
    })
})


//POSt mthod receving from clerk for dding entries in database
//https://clerk.com/docs/webhooks/sync-data   use this for refrenece 
//will help us to take decision anything in user creation,deletion,updation 

router.post("/api/webhook/clerk", async (req, res) => {
    console.log("recived the request")
    const SIGNING_SECRET = process.env.SIGNING_SECRET;
  
    if (!SIGNING_SECRET) {
      throw new Error(
        "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env"
      );
    }
  
    const wh = new Webhook(SIGNING_SECRET);
    const headers = req.headers;
    const payload = req.body;
  
    const svix_id = headers["svix-id"];
    const svix_timestamp = headers["svix-timestamp"];
    const svix_signature = headers["svix-signature"];
  
    if (!svix_id || !svix_timestamp || !svix_signature) {
      res.status(400).json({
        success: false,
        message: "Error: Missing svix headers",
      });
      return;
    }
  
    let evt: any;
  
    try {
      evt = wh.verify(JSON.stringify(payload), {
        "svix-id": svix_id as string,
        "svix-timestamp": svix_timestamp as string,
        "svix-signature": svix_signature as string,
      });
    } catch (err) {
      console.log("Error: Could not verify webhook:", (err as Error).message);
      res.status(400).json({
        success: false,
        message: (err as Error).message,
      });
      return;
    }
  
    const { id } = evt.data;
    const eventType = evt.type;
  
    try {
      switch (eventType) {
        case "user.created":
        case "user.updated": {
          await prismaClient.user.upsert({
            where: { clerkId: id },
            update: {
              username: `${evt.data.first_name ?? ""} ${evt.data.last_name ?? ""}`.trim(),
              email: evt.data.email_addresses[0].email_address,
              profilePicture: evt.data.profile_image_url,
            },
            create: {
              clerkId: id,
              username: `${evt.data.first_name ?? ""} ${evt.data.last_name ?? ""}`.trim(),
              email: evt.data.email_addresses[0].email_address,
              profilePicture: evt.data.profile_image_url,
            },
          });
          break;
        }
  
        case "user.deleted": {
          await prismaClient.user.delete({
            where: { clerkId: id },
          });
          break;
        }
  
        default:
          console.log(`Unhandled event type: ${eventType}`);
          break;
      }
    } catch (error) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
      return;
    }
  
    res.status(200).json({ success: true, message: "Webhook received" });
    return;
  });

export default router;