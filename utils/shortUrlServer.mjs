import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

export async function shortUrlServer() {
  app.get("/:id", async (req, res) => {
    const shortId = req.params.id;

    try {
      const urlRecord = await prisma.url.findUnique({
        where: { shortId: shortId },
      });

      if (urlRecord) {
        res.redirect(urlRecord.longUrl);
      } else {
        res.status(404).send("404 NOT FOUND");
      }
    } catch (error) {
      console.error("Error fetching URL record:", error);
      res.status(500).send("500 INTERNAL SERVER ERROR");
    }
  });

  app.listen(PORT, () => {
    console.log(`HTTP SERVICE RUNNING ON PORT ${PORT}`);
  });
}