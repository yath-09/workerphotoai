import { PrismaClient } from "@prisma/client";

export const prismaClient = new PrismaClient();
import express from "express";
const router = express.Router();
import {fal} from '@fal-ai/client'
import { FalAiModel } from "./FalAiModel";

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

export default router;