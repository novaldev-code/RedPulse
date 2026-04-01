import type { NextFunction, Request, Response } from "express";
import { readAuthUserFromRequest } from "../lib/jwt.js";

export function attachAuthUser(request: Request, _response: Response, next: NextFunction) {
  const user = readAuthUserFromRequest(request);

  if (user) {
    request.user = user;
  }

  next();
}

export function authenticate(request: Request, response: Response, next: NextFunction) {
  const user = readAuthUserFromRequest(request);

  if (!user) {
    response.status(401).json({
      message: "Authentication required."
    });
    return;
  }

  request.user = user;
  next();
}
