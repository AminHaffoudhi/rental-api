import type { Request, Response } from "express";
import * as contactService from "@/services/contact.service";
import { success } from "@/utils/apiResponse";

export async function submit(req: Request, res: Response): Promise<void> {
  const { id } = await contactService.submitContactForm(req.body);
  success(
    res,
    {
      id,
      message: "Your message has been sent. We will get back to you soon.",
    },
    201
  );
}
