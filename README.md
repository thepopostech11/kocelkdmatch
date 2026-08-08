# Remix of KOCEL Trader phase 4

PHASE 1 — KOCEL DMATCH TOOL

PROJECT FOUNDATION, AUTHENTICATION, PROFESSIONAL UI & APPLICATION ARCHITECTURE



MASTER PROMPT — PHASE 1

Project Name

KOCEL DMATCH TOOL



Project Overview

Develop a professional AI-powered MATCHES trading platform for Deriv named KOCEL DMATCH TOOL.

This is a completely new application.

this application supports:

AI Analysis

Manual Trading

MATCHES Bot Trading

using the official Deriv APIs.

The application must have a premium modern appearance comparable to professional trading platforms.



IMPORTANT

This phase DOES NOT develop:

Analysis Engine

Manual Trading Engine

Bot Engine

Those will be developed in later phases.

This phase focuses only on:

Authentication

App Structure

Dashboard

Navigation

UI

Account Management

Settings

Theme

Responsive Design

WebSocket Foundation

Trading Infrastructure Preparation



Technology Stack

Frontend

React 19

TypeScript

Vite

Bootstrap 5

Tailwind CSS

Framer Motion

React Router

React Query

Zustand

React Hook Form

Charts

Lightweight Charts

Recharts

Backend

Node.js

Express

TypeScript

Deriv

Official Deriv WebSocket API

Official OAuth Login

Official Trading API

State Management

Zustand

Animations

Framer Motion

Notifications

React Hot Toast

Icons

Lucide Icons

Tables

TanStack Table

Theme

Dark Premium

Light Theme



Authentication

Use the official Deriv OAuth flow.

Prepare the application for secure authentication using the user’s registered Deriv application.

Implement:

Login with Deriv

OAuth Redirect Handling

Token Management

Session Restoration

Automatic Token Refresh (where applicable)

Secure Logout

Do not hard-code credentials. Read configuration from environment variables or a secure configuration layer.



Login Page

Create a premium login page.

Display

KOCEL DMATCH TOOL

Subtitle

AI Powered MATCHES Trading Platform

Background

Animated gradient

Floating trading particles

Moving glowing effects

Professional card

Display

Login with Deriv

button

Below

Secure Authentication

Powered by Deriv

Remember session

Loading animation

Version

Connection Status



OAuth Flow

Implement

Redirect to Deriv

↓

Authorize

↓

Callback

↓

Validate

↓

Store Session

↓

Dashboard

Automatically restore session after refresh.



Dashboard Layout

After login

Display

Top Navigation

Left Sidebar

Main Workspace

Bottom Status Bar

Responsive Layout



Sidebar

Only

Analysis

Manual Trade

Bot

Settings

Logout

Nothing else.



Default Screen

After login

Open

Analysis

even though it will be empty for now.

Display

Coming in Phase 2

Analysis Engine



Top Navigation

Display

Logo

KOCEL DMATCH TOOL

Selected Account

Account Type

Balance

Current Symbol

Connection Status

Notification Bell

Settings

User Avatar

Logout



Account Selector

Support

Demo

Real

Multiple Accounts

Allow switching between authorized accounts without logging out.



Bottom Status Bar

Display

WebSocket Status

OAuth Status

Current Symbol

Latency

Server Time

Market Feed Status

Version



Settings Page

Create a professional settings page.

Sections

General

Trading

Notifications

Appearance

Performance

About

Privacy

Security



General Settings

Theme

Language

Default Symbol

Default Tick Window

Default Stake

Default Contract Duration

Remember Preferences

Auto Connect



Appearance

Dark Theme

Light Theme

System Theme

Font Size

Animation Speed

Compact Mode



Notifications

Trade Notifications

Bot Notifications

Sound

Entry Alerts

Prediction Alerts

Desktop Notifications



Performance

FPS Counter

Memory Usage

Rendering Mode

Refresh Interval

Developer Mode

Live Diagnostics



About

Application Version

API Version

Deriv Status

License

Developer



Security

Logout All Sessions

Clear Cache

Clear Local Storage

Session Timeout

Reconnect Automatically



Responsive UI

Application must work perfectly on

Mobile

Tablet

Laptop

Desktop

Ultra-wide

Android TV

Cards automatically resize.

No overlapping.

No horizontal scrolling.



Theme

Premium dark trading interface.

Primary

Blue

Secondary

Purple

Accent

Green

Warning

Orange

Danger

Red

Smooth gradients.

Rounded cards.

Glassmorphism.

Soft shadows.

Professional spacing.



Loading Experience

Professional splash screen.

Display

Logo

Loading Progress

Initializing Modules

Connecting

Authenticating

Preparing Workspace



Global Components

Prepare reusable components.

Button

Card

Modal

Dialog

Notification

Loading Spinner

Status Badge

Tooltip

Dropdown

Tabs

Sidebar

Topbar

Data Table

Confirmation Dialog



Notification System

Global notification center.

Support

Success

Error

Warning

Info

Trade Notifications

Bot Notifications

Connection Notifications



Application State

Create global stores for

Authentication

Account

Settings

Theme

Connection

Notifications

User Preferences

Selected Symbol

Selected Tick Window

Application Status



Symbol Persistence

When user selects a symbol later

Store locally.

After refresh

Restore automatically.

Never reset unexpectedly.



WebSocket Foundation

Create

WebSocket Manager

Connection Manager

Heartbeat Manager

Reconnect Manager

Subscription Manager

TickStreamManager

These managers should exist now but their trading logic will be implemented in later phases.



API Layer

Prepare services

Authentication Service

Account Service

Trading Service

Market Data Service

Bot Service

Settings Service

Notification Service

Analysis Service

Only create architecture.

No trading implementation yet.



Folder Structure

src/



components/



layouts/



pages/



Analysis/



ManualTrade/



Bot/



Settings/



services/



hooks/



stores/



types/



utils/



styles/



config/



assets/



contexts/



router/



api/



websocket/



engines/



models/



notifications/



Empty Sections

Analysis

Display

Coming in Phase 2

AI MATCHES Analysis Engine

Manual Trade

Display

Coming in Phase 3

Manual Trading Interface

Bot

Display

Coming in Phase 4

AI MATCHES Bot



Future Module Registration

Prepare independent modules

Authentication Engine

OAuth Manager

Connection Manager

TickStreamManager

Analysis Engine

Prediction Engine

Strategy Engine

Manual Trading Engine

Bot Engine

Trade Execution Engine

Risk Engine

Notification Engine

Settings Engine

Performance Monitor

Logging Engine

Each module must remain independent and communicate through well-defined interfaces rather than directly depending on one another.



Final Requirements

Phase 1 should deliver a polished, production-ready shell of the application:

Secure Deriv OAuth authentication.

Professional responsive dashboard.

Three navigation sections (Analysis, Manual Trade, Bot).

Complete settings interface.

Multi-account support.

Theme switching.

Session persistence.

WebSocket and service architecture ready for future phases.

No analysis or trading logic implemented yet.

The result should feel like a finished premium trading platform, with the analytical and trading capabilities to be added incrementally in Phases 2–4.





This is how to authenticate “[Getting Started](/docs)

# OAuth 2.0

A complete guide to implementing Login and Sign Up using Deriv's OAuth 2.0 Authorization Code flow with PKCE.

## How the flow works

1

Generate PKCE

2

Redirect to Deriv

3

User Authenticates

4

Exchange Code

5

Use Token

1. **Generate PKCE —** Create a `code_verifier` (random string) and derive `code_challenge` = BASE64URL(SHA256(code_verifier)). Also generate a random `state` for CSRF protection.

2. **Redirect to Deriv —** Send the user to Deriv's authorization URL with all required parameters.

3. **User authenticates —** Deriv shows either the login or registration form. All login and consent screens are managed by the OAuth provider.

4. **Redirect back —** Deriv redirects the user to your `redirect_uri` with an authorization `code` and `state`.

5. **Verify state —** Confirm the returned `state` matches what you stored. This prevents CSRF attacks.

6. **Exchange code for token —** Your backend sends the `code` + `code_verifier` to Deriv's token endpoint and receives an `access_token`.

7. **Use the token —** Make authenticated API calls using the Bearer token.

## Before you start

You need:

- A registered OAuth2 client from Deriv with a `client_id` and a pre-registered `redirect_uri`.

- HTTPS enabled on your redirect URL.

- Your app must handle redirects, read the authorization code, and exchange it for tokens.

## Step 1: Generate PKCE parameters

##### What is PKCE?

**PKCE** (Proof Key for Code Exchange, pronounced 'pixy') prevents authorization code interception attacks. Even if an attacker intercepts the authorization code, they cannot exchange it without the original `code_verifier` that only your app generated and stored.

| Term | What it is |

| --- | --- |

| `code_verifier` | A cryptographically random string (43–128 characters) generated by your app |

| `code_challenge` | `BASE64URL(SHA256(code_verifier))` — sent with the authorization request |

| `code_challenge_method` | Always S256 (SHA-256) |

**Why it works:** Only the app that generated the `code_verifier` can complete the token exchange.

### Generating PKCE in JavaScript

```javascript

// 1. Generate a random code_verifier

const array = crypto.getRandomValues(new Uint8Array(64));

const codeVerifier = Array.from(array)

  .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])

  .join('');

// 2. Derive the code_challenge

const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))

  .replace(/\+/g, '-')

  .replace(/\//g, '_')

  .replace(/=+$/, '');

// 3. Generate a random state for CSRF protection

const state = crypto.getRandomValues(new Uint8Array(16))

  .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

// 4. Store code_verifier and state before redirecting

sessionStorage.setItem('pkce_code_verifier', codeVerifier);

sessionStorage.setItem('oauth_state', state);

```

Required authorization request parameters:

- response_type=code

- client_id

- redirect_uri

- scope

- state

- code_challenge + code_challenge_method=S256 (PKCE)

##### Storage tip

Store the `code_verifier` and `state` in `sessionStorage` before redirecting — they survive the redirect and are automatically cleared when the tab is closed. Clear them from storage immediately after a successful token exchange.

## Step 2: Redirect the user to the authorization endpoint

Send users to Deriv's OAuth 2.0 authorization endpoint:

```bash

https://auth.deriv.com/oauth2/auth

```

### Login

Login uses the standard OAuth2 + PKCE parameters with no additions.

#### Parameters

| Parameter | Value | Description |

| --- | --- | --- |

| `response_type` Required | `code` | Request an authorization code |

| `client_id` Required | `Your app ID` | Registered OAuth2 application ID from Deriv |

| `redirect_uri` Required | `Your callback URL` | Must exactly match the URI registered with Deriv |

| `scope` Required | `trade` `account_manage` `application_read` `payment` | Space-separated list of the permissions your app requests — see the OAuth scopes table below |

| `state` Required | `Random string` | CSRF protection — generate a new value for each request |

| `code_challenge` Required | `BASE64URL(SHA256(verifier))` | The PKCE challenge derived from code_verifier |

| `code_challenge_method` Required | `S256` | Always SHA-256 |

| `app_id` Optional | `Your legacy app ID` | Your V1 app ID from the Legacy Deriv API — include this only if you also maintain a legacy API app |

#### OAuth Scopes

The scope parameter is a space-separated list of the permissions your app requests. Request only the scopes your app needs.

| Scope | Description |

| --- | --- |

| `trade` | Access to trading operations. |

| `account_manage` | Write access for account creation and management. |

| `application_read` | Read-only access to your registered applications. |

| `payment` | Access to payment agent deposit and withdrawal operations. |

#### Login URL

```bash

https://auth.deriv.com/oauth2/auth?

  response_type=code

  &client_id={YOUR_CLIENT_ID}          # e.g. app12345

  &redirect_uri={YOUR_REDIRECT_URI}    # e.g. https://yourapp.com/callback

  &scope=trade+account_manage

  &state={RANDOM_STATE}                # e.g. abc123random

  &code_challenge={PKCE_CHALLENGE}     # e.g. E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM

  &code_challenge_method=S256

```

##### Also maintaining a Legacy API app?

If you also have an app on the Legacy Deriv API, append `&app_id=YOUR_LEGACY_APP_ID` to the login URL (and sign up URL). Deriv will check whether the user belongs to the old or new platform and route them to the appropriate version of your app.

#### Login URL with legacy app support

```bash

https://auth.deriv.com/oauth2/auth?

  response_type=code

  &client_id={YOUR_CLIENT_ID}

  &redirect_uri={YOUR_REDIRECT_URI}

  &scope=trade+account_manage

  &state={RANDOM_STATE}

  &code_challenge={PKCE_CHALLENGE}

  &code_challenge_method=S256

  &app_id={YOUR_LEGACY_APP_ID}      # V1 app ID from legacy-api.deriv.com

```

### Sign Up

Sign up uses the same base URL and parameters as login, plus one additional required parameter:

#### Required sign up parameter

| Parameter | Value | Description |

| --- | --- | --- |

| `prompt` Required | `registration` | Always this exact value. Tells Deriv to show the signup form instead of login. |

#### Optional partner attribution parameters

The following parameters are all optional and managed in the Partners dashboard. Include them to attribute signups to your partner account. The tracking token parameter has four equivalent names (`t`, `affiliate_token`, `sidi`, `ca`) — use whichever one appears in your referral link or Partners dashboard.

| Parameter | Value | Purpose |

| --- | --- | --- |

| `t` `affiliate_token` `sidi` `ca` | Your affiliate tracking token | Tracking and attribution. Use **only one** of these parameter names — they are equivalent aliases. Pick the one that appears in your referral link or in the Partners dashboard. |

| `utm_campaign` | Your campaign name | Identifies the marketing campaign |

| `utm_medium` | affiliate | Indicates a partner integration |

| `utm_source` | Your affiliate ID | Commission tracking and reporting |

##### Which tracking parameter should I use?

`t`, `affiliate_token`, `sidi`, and `ca` all serve the same purpose. Use the one that appears in your Deriv referral link or in your Partners dashboard — don't include more than one.

#### Sign Up URL

```bash

https://auth.deriv.com/oauth2/auth?

  response_type=code

  &client_id={YOUR_CLIENT_ID}          # e.g. app12345

  &redirect_uri={YOUR_REDIRECT_URI}    # e.g. https://yourapp.com/callback

  &scope=trade+account_manage

  &state={RANDOM_STATE}                # e.g. abc123random

  &code_challenge={PKCE_CHALLENGE}     # e.g. E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM

  &code_challenge_method=S256

  &prompt=registration

  &t={YOUR_TRACKING_TOKEN}             # or: affiliate_token | sidi | ca — use the name from your referral link

  &utm_campaign={YOUR_CAMPAIGN}        # e.g. dynamicworks

  &utm_medium=affiliate

  &utm_source={YOUR_AFFILIATE_ID}      # e.g. CU303219

```

##### Important

Always validate the `state` parameter on return and generate your `code_challenge` from a secure random `code_verifier`. Never reuse these values between requests.

## Step 3: Handle the callback

Whether the user logged in or signed up, the callback works exactly the same way. After authentication, Deriv redirects to your `redirect_uri`:

```bash

https://yourapp.com/callback?code=AUTHORIZATION_CODE&state=RANDOM_STATE

```

If something went wrong:

```bash

https://yourapp.com/callback?error=access_denied&error_description=User+cancelled

```

### Your app must:

1. **Verify the state —** compare the `state` from the URL with the value you stored before the redirect. If they don't match, abort — it may be a CSRF attack.

2. **Extract the code —** read the `code` query parameter.

##### The authorization code is single-use and expires quickly

Exchange it immediately. Do not store or log authorization codes.

## Step 4: Exchange code for tokens

Make a POST request from your **backend** to the token endpoint. Never perform the token exchange from the browser.

```http

POST https://auth.deriv.com/oauth2/token

```

### Request body (form-encoded)

```bash

grant_type=authorization_code

client_id=YOUR_CLIENT_ID

code=AUTH_CODE_FROM_CALLBACK

code_verifier=YOUR_ORIGINAL_CODE_VERIFIER

redirect_uri=https://your-app.com/callback

```

### cURL example

```bash

curl -X POST https://auth.deriv.com/oauth2/token \

  -H "Content-Type: application/x-www-form-urlencoded" \

  -d "grant_type=authorization_code" \

  -d "client_id=YOUR_CLIENT_ID" \

  -d "code=AUTH_CODE" \

  -d "code_verifier=YOUR_CODE_VERIFIER" \

  -d "redirect_uri=https://your-app.com/callback"

```

### Token response

```json

{

  "access_token": "ory_at_...",

  "expires_in": 3600,

  "token_type": "Bearer"

}

```

## Step 5: Use the access token in API calls

Include the access token as a Bearer token in the `Authorization` header for all API calls:

```http

Authorization: Bearer YOUR_ACCESS_TOKEN

```

### Example

```bash

curl -X GET "https://api.derivws.com/trading/v1/options/accounts" \

  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

```

## Quick reference

| Endpoint | URL |

| --- | --- |

| Authorization | `https://auth.deriv.com/oauth2/auth` |

| Token exchange | `https://auth.deriv.com/oauth2/token` |

| API base URL | `https://api.derivws.com` |

Where to find your values:

| Value | Where |

| --- | --- |

| `client_id` | Register an OAuth2 app with Deriv — you'll receive an app ID |

| `redirect_uri` | Set during app registration — must match exactly |

| `t / affiliate_token / sidi / ca (signup)` | Your referral link or the Partners dashboard — use the exact parameter name shown there |

| `utm_source / affiliate ID (signup)` | Managed and set in the Partners dashboard |

| `utm_campaign (signup)` | Managed and set in the Partners dashboard |

| `app_id (legacy)` | Your V1 app ID from legacy-api.deriv.com — only needed if you maintain a Legacy API app |

## Troubleshooting

| Problem | Likely cause | Fix |

| --- | --- | --- |

| State mismatch error | state in the callback doesn't match stored value | Store state in sessionStorage before redirecting, and don't regenerate it on page load |

| invalid_grant on token exchange | code_verifier doesn't match the challenge, or code expired/already used | Send the original code_verifier, not a newly generated one; exchange the code immediately |

| Redirect URI mismatch | URL doesn't exactly match what's registered | Check for trailing slashes, http vs https, port numbers |

| invalid_client | Wrong client_id | Verify your credentials from the Deriv dashboard |

| Login form shows instead of signup | Missing prompt=registration | Add prompt=registration to the authorization URL |

| Signup not tracked to partner | Missing or wrong UTM parameters | Verify your tracking token parameter (one of t, affiliate_token, sidi, or ca) matches the one shown in your referral link, and that utm_source, utm_medium, and utm_campaign are all present and correct |

## Implementation checklist

### Login

- `response_type` is `code`

- `client_id` and `redirect_uri` are registered with Deriv

- `code_challenge` and `state` are generated fresh for each request

- `code_verifier` is stored in `sessionStorage` before redirect

- Callback verifies `state` before exchanging the code

- Token exchange happens server-side (not in the browser)

- `code_verifier` is cleared from storage after use

- If maintaining a legacy app, `app_id` is set to your Legacy app ID (optional)

### Sign Up (additional)

- `prompt` is set to `registration` (required)

- Tracking token (one of `t`, `affiliate_token`, `sidi`, `ca`) `utm_source`, `utm_campaign`, and `utm_medium` are set if needed — use the parameter name shown in your referral link or Partners dashboard (optional)” 





App id: 341wtpayB6TTevM7ac4LR

Redirect URL

https://kocelkdmatch.lovable.app/oauth/callback





After user logged in with his deriv account, let the tool show loading and fetching live streaming and statistics from deriv by showing a modern nice progress loading indicator with nice percent faded on it nicely.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kocelkdmatch.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/59b63f62-48ce-43f8-8682-61f294ba6ff0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
