"use strict";

const { isIP } = require("node:net");

function validSingleIp(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  if (!candidate || candidate.includes(",")) return "";
  return isIP(candidate) ? candidate.toLowerCase() : "";
}

function header(req, name) {
  const value = req?.headers?.[name];
  return typeof value === "string" ? value : "";
}

/**
 * Render and Vercel both sit behind trusted edge networks in production.
 * Render's Cloudflare edge sets CF-Connecting-IP; Vercel sets x-real-ip and
 * x-vercel-id. Never use the left-most X-Forwarded-For value because clients
 * can supply values that proxies append to.
 */
function getClientIp(req) {
  const cloudflareIp = header(req, "cf-connecting-ip");
  if (cloudflareIp) return validSingleIp(cloudflareIp) || socketIp(req);

  const vercelRequestId = header(req, "x-vercel-id");
  if (vercelRequestId) {
    const vercelIp = validSingleIp(header(req, "x-real-ip"));
    if (vercelIp) return vercelIp;
  }

  return socketIp(req);
}

function socketIp(req) {
  const candidate = req?.socket?.remoteAddress;
  return validSingleIp(candidate) || "unknown";
}

module.exports = { getClientIp, validSingleIp };
