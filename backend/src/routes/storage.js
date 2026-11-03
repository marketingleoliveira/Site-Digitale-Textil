import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";

import fsSync from "fs";
import fs from "fs/promises";

import path from "path";
import os from "os";
import crypto from "crypto";

import { config } from "../config.js";


const router =
  express.Router();


/*
 * Vídeos não devem ficar inteiros
 * carregados na memória do Node.
 *
 * O upload passa primeiro por disco
 * temporário e depois é movido para
 * o storage definitivo.
 */
const temporaryUploadPath =
  path.join(
    os.tmpdir(),
    "site-digitale-upload-tmp"
  );


fsSync.mkdirSync(
  temporaryUploadPath,
  {
    recursive: true
  }
);


const upload =
  multer({
    storage:
      multer.diskStorage({

        destination(
          _req,
          _file,
          callback
        ) {

          callback(
            null,
            temporaryUploadPath
          );
        },


        filename(
          _req,
          file,
          callback
        ) {

          const extension =
            path.extname(
              file.originalname
              || ""
            )
            .slice(0, 20);

          callback(
            null,
            `${Date.now()}-${crypto.randomUUID()}${extension}`
          );
        }
      }),

    limits: {

      /*
       * 1 GB por arquivo.
       */
      fileSize:
        1024
        *
        1024
        *
        1024,

      files: 1
    }
  });


function authenticated(
  req
) {

  const authorization =
    String(
      req.headers.authorization
      || ""
    );


  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }


  try {

    return jwt.verify(
      authorization.substring(7),
      config.jwtSecret
    );

  } catch {

    return null;
  }
}


function safe(
  value
) {

  const normalized =
    path
      .normalize(
        String(
          value
          || ""
        )
        .replaceAll(
          "\\",
          "/"
        )
      )
      .replace(
        /^(\.\.(\/|\\|$))+/,
        ""
      )
      .replace(
        /^\/+/,
        ""
      );


  if (
    normalized.includes("..")
    ||
    normalized.includes("\0")
  ) {

    throw new Error(
      "invalid_path"
    );
  }


  return normalized;
}


async function removeTemporaryFile(
  file
) {

  if (!file?.path) {
    return;
  }


  try {

    await fs.rm(
      file.path,
      {
        force: true
      }
    );

  } catch {}
}


async function moveFile(
  source,
  destination
) {

  try {

    await fs.rename(
      source,
      destination
    );


  } catch (error) {

    /*
     * Caso temporário e destino
     * estejam em filesystems diferentes.
     */
    if (
      error?.code
      !==
      "EXDEV"
    ) {

      throw error;
    }


    await fs.copyFile(
      source,
      destination
    );


    await fs.rm(
      source,
      {
        force: true
      }
    );
  }
}


function singleUpload(
  req,
  res,
  next
) {

  upload.single(
    "file"
  )(
    req,
    res,
    error => {

      if (!error) {

        return next();
      }


      console.error(
        "STORAGE MULTER:",
        error
      );


      if (
        error instanceof
          multer.MulterError
        &&
        error.code
        ===
        "LIMIT_FILE_SIZE"
      ) {

        return res
          .status(413)
          .json({
            data: null,

            error: {
              message:
                "Arquivo excede o limite de 1 GB."
            }
          });
      }


      return res
        .status(400)
        .json({
          data: null,

          error: {
            message:
              error?.message
              ||
              "upload_invalid"
          }
        });
    }
  );
}


router.post(
  "/:bucket/upload",
  singleUpload,
  async (
    req,
    res
  ) => {

    try {

      if (
        !authenticated(req)
      ) {

        await removeTemporaryFile(
          req.file
        );


        return res
          .status(401)
          .json({
            data: null,

            error: {
              message:
                "unauthorized"
            }
          });
      }


      if (!req.file) {

        return res
          .status(400)
          .json({
            data: null,

            error: {
              message:
                "file_required"
            }
          });
      }


      const bucket =
        safe(
          req.params.bucket
        );


      const requestedPath =
        safe(
          req.body.path
          ||
          req.file.originalname
        );


      if (
        !bucket
        ||
        !requestedPath
      ) {

        await removeTemporaryFile(
          req.file
        );


        return res
          .status(400)
          .json({
            data: null,

            error: {
              message:
                "invalid_upload_path"
            }
          });
      }


      const destination =
        path.join(
          config.uploadsPath,
          bucket,
          requestedPath
        );


      /*
       * Impede qualquer escape do
       * diretório oficial de uploads.
       */
      const bucketRoot =
        path.resolve(
          config.uploadsPath,
          bucket
        );


      const resolvedDestination =
        path.resolve(
          destination
        );


      if (
        resolvedDestination
        !==
        bucketRoot
        &&
        !resolvedDestination.startsWith(
          bucketRoot
          +
          path.sep
        )
      ) {

        await removeTemporaryFile(
          req.file
        );


        throw new Error(
          "invalid_destination"
        );
      }


      await fs.mkdir(
        path.dirname(
          resolvedDestination
        ),
        {
          recursive: true
        }
      );


      await moveFile(
        req.file.path,
        resolvedDestination
      );


      return res.json({
        data: {

          path:
            requestedPath,

          fullPath:
            `${bucket}/${requestedPath}`,

          size:
            req.file.size,

          mimetype:
            req.file.mimetype
        },

        error: null
      });


    } catch (error) {

      await removeTemporaryFile(
        req.file
      );


      console.error(
        "STORAGE UPLOAD:",
        error
      );


      return res
        .status(500)
        .json({
          data: null,

          error: {
            message:
              error?.message
              ||
              "upload_failed"
          }
        });
    }
  }
);


router.delete(
  "/:bucket",
  async (
    req,
    res
  ) => {

    try {

      if (
        !authenticated(req)
      ) {

        return res
          .status(401)
          .json({
            data: null,

            error: {
              message:
                "unauthorized"
            }
          });
      }


      const bucket =
        safe(
          req.params.bucket
        );


      const paths =
        Array.isArray(
          req.body?.paths
        )
          ?
          req.body.paths
          :
          [];


      const removed = [];


      for (
        const item
        of paths
      ) {

        const clean =
          safe(item);


        const target =
          path.join(
            config.uploadsPath,
            bucket,
            clean
          );


        await fs.rm(
          target,
          {
            force: true
          }
        );


        removed.push({
          name:
            clean
        });
      }


      return res.json({
        data:
          removed,

        error:
          null
      });


    } catch (error) {

      return res
        .status(500)
        .json({
          data: null,

          error: {
            message:
              error?.message
              ||
              "remove_failed"
          }
        });
    }
  }
);


router.get(
  "/:bucket/list",
  async (
    req,
    res
  ) => {

    try {

      const bucket =
        safe(
          req.params.bucket
        );


      const folder =
        safe(
          req.query.path
          ||
          ""
        );


      const target =
        path.join(
          config.uploadsPath,
          bucket,
          folder
        );


      let entries = [];


      try {

        entries =
          await fs.readdir(
            target,
            {
              withFileTypes:
                true
            }
          );

      } catch {

        entries = [];
      }


      return res.json({
        data:
          entries.map(
            entry => ({
              name:
                entry.name,

              id:
                null,

              metadata: {
                isDirectory:
                  entry.isDirectory()
              }
            })
          ),

        error:
          null
      });


    } catch (error) {

      return res
        .status(500)
        .json({
          data: null,

          error: {
            message:
              error?.message
              ||
              "list_failed"
          }
        });
    }
  }
);


export default router;
