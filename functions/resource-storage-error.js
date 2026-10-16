"use strict";

function resourceStorageError(error, HttpsError, label = "resource files", missingMessage) {
  if (error instanceof HttpsError) return error;
  const code=Number(error?.code || error?.statusCode || error?.response?.statusCode);
  // Keep provider response bodies, object paths and credentials out of browser errors.
  console.warn("Nexus resource storage operation failed", {code:Number.isFinite(code)?code:"unknown",label});
  if(code===404 || code===5)return new HttpsError("not-found",missingMessage || `The ${label} could not be found. Select or upload the workbook again.`);
  if(code===403 || code===401 || code===7 || code===16)return new HttpsError("failed-precondition",`Nexus's server cannot access ${label}. An administrator must restore its Storage permission; uploading the same file again will not fix this.`);
  if([408,429,500,502,503,504,4,8,14].includes(code))return new HttpsError("unavailable",`Storage is temporarily unavailable for ${label}. Wait a moment and retry.`);
  return new HttpsError("internal",`Nexus could not read ${label}. Ask an administrator to check the server logs.`);
}

module.exports={resourceStorageError};
