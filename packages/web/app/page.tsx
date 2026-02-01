import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to the work orders dashboard.
  // That page handles its own auth check and will send
  // unauthenticated users to /login.
  redirect('/workorders')
}
