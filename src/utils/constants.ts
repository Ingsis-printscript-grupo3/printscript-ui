export const FRONTEND_URL = (process?.env?.FRONTEND_URL ?? "http://localhost:5173").replace(/\/+$/, "")
export const BACKEND_URL = (process?.env?.BACKEND_URL ?? "http://localhost:8080").replace(/\/+$/, "")
export const AUTH0_USERNAME = process?.env?.AUTH0_USERNAME ?? ""
export const AUTH0_PASSWORD = process?.env?.AUTH0_PASSWORD ?? ""
