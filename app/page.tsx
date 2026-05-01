import { ChatInterface } from '@/components/chat/ChatInterface'
import { AppShell } from '@/components/layout/AppShell'

export default function Home() {
  return (
    <AppShell>
      <ChatInterface />
    </AppShell>
  )
}
