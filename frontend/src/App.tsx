import React from 'react'
import { UserProvider } from './contexts/UserContext'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'

export default function App() {
  return (
    <UserProvider>
      <MainLayout>
        <Home />
      </MainLayout>
    </UserProvider>
  )
}
