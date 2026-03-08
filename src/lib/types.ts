export type HttpMethod = "GET" | "POST";

export type OAuthGrantType =
  | "client_credentials"
  | "password"
  | "authorization_code"
  | "refresh_token";

export type ApiEndpointConfig = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;

  sampleCapturedAt?: string; // ISO timestamp

  runInStep1?: boolean; // default true

  authType: "None" | "API Key" | "OAuth2";

  // API Key
  apiKeyHeaderName?: string;
  apiKeyValue?: string;

  // OAuth2
  oauthTokenUrl?: string;
  oauthGrantType?: OAuthGrantType;

  // Client credentials
  oauthClientId?: string;
  oauthClientSecret?: string;

  // Password grant (optional)
  oauthUsername?: string;
  oauthPassword?: string;

  // Auth code grant (optional placeholders)
  oauthRedirectUri?: string;
  oauthCode?: string;

  // Refresh token grant
  oauthRefreshToken?: string;

  oauthScope?: string;
  oauthAudience?: string;

  // Main API request payload (used when method is POST)
  requestBodyJson?: string; // JSON string

  headersJson: string;

  lastTestStatus?: "Not tested" | "OK" | "Failed";
  lastTestMessage?: string;
  lastTestMs?: number;
  sampleResponseJson?: string;
};