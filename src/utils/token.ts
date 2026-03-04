import { Response } from "express";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { jwtUtils } from "./jwt";
import { envConfig } from "../config/env";
import { CookieUtils } from "./cookie";

const isProduction = envConfig.NODE_ENV === "production";
console.log("isprod", isProduction);

const getAccessToken = (payload: JwtPayload) => {
    return jwtUtils.createToken(
        payload,
        envConfig.ACCESS_TOKEN_SECRET,
        { expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN } as SignOptions
    );
}

const getRefreshToken = (payload: JwtPayload) => {
    return jwtUtils.createToken(
        payload,
        envConfig.REFRESH_TOKEN_SECRET,
        { expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN } as SignOptions
    );
}

const setAccessTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'accessToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        maxAge: 2 * 60 * 1000, // 15 minutes in milliseconds
    });
}

const setRefreshTokenCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, 'refreshToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        maxAge: 30 * 60 * 1000, // 7 days in milliseconds
    });
}

const setBetterAuthSessionCookie = (res: Response, token: string) => {
    CookieUtils.setCookie(res, "better-auth.session_token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: '/',
        maxAge: 2 * 60 * 1000, // 1 day in milliseconds
    });
}

export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setBetterAuthSessionCookie,
}