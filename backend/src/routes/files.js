import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import { db } from "../database.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(config.uploadsPath, {
      recursive: true
    });

    cb(null, config.uploadsPath);
  },

  filename(req, file, cb) {
    const extension = path.extname(file.originalname || "");
    const filename =
      crypto.randomUUID() +
      extension.toLowerCase();

    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        error: "file_required"
      });
    }

    const filePath = req.file.filename;

    const [result] = await db.execute(
      `
        INSERT INTO system_files (
          bucket,
          file_path,
          original_name,
          mime_type,
          file_size,
          uploaded_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        "public",
        filePath,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user.systemId
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      path: filePath,
      url: "/uploads/" + filePath
    });
  }
);

export default router;
