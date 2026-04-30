import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/drive.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // První login — ulož tokeny
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Token je stále platný
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Token expiroval — refresh
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken as string,
          }),
        })

        const refreshed = await res.json()
        if (!res.ok) throw refreshed

        return {
          ...token,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        }
      } catch (err) {
        console.error('Token refresh failed:', err)
        return { ...token, error: 'RefreshAccessTokenError' }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      if (token.error) session.error = token.error as string
      return session
    },
  },
})
