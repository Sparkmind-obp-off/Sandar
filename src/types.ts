export type Bindings = {
  DB: D1Database
  ENVIRONMENT?: string // 'production' | 'development' | 'test'
  APP_ORIGIN?: string // canonical app origin, e.g. https://sandar.biz.id
  CLERK_PUBLISHABLE_KEY?: string
  CLERK_SECRET_KEY?: string
  CLERK_ISSUER?: string
  CLERK_JWT_KEY?: string // optional PEM public key for networkless verification
  AUTHORIZED_PARTIES?: string // comma-separated allowed `azp` origins
  ADMIN_SUBJECTS?: string // comma-separated Clerk user IDs allowed to curate
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
  TAVILY_API_KEY?: string
  FIRECRAWL_API_KEY?: string
  PROVIDER_DAILY_CAPS?: string // e.g. "groq=200,tavily=30,firecrawl=10"
  BILLING_ENABLED?: string // 'true' to enable checkout; default OFF
  PAYMENT_PROVIDER?: string // 'none' | 'mock' | 'midtrans' | 'xendit'
  MOCK_PAYMENT_SECRET?: string
  MIDTRANS_SERVER_KEY?: string
  XENDIT_CALLBACK_TOKEN?: string
}

export type AuthUser = {
  id: string
  sub: string
  workspaceId: string
  planId: string
  isAdmin: boolean
}

export type Vars = {
  correlationId: string
  user: AuthUser
}

export type AppEnv = { Bindings: Bindings; Variables: Vars }
