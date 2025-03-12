import crypto from "crypto";

export function verifySignature(body, secret, signatureHeader) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body, "utf8");
  const digest = "sha256=" + hmac.digest("hex");
  return digest === signatureHeader;
}

export function extractIssueNumber(branchName) {
  const match = branchName.match(/^(feature|fix)-[a-z]+-(\d+)-[a-z0-9-]+$/i);
  return match ? match[2] : null;
}
