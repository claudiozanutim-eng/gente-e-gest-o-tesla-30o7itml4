import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapse = () => setCollapsed((prev) => !prev)
  const toggleMobileMenu = () => setMobileOpen((prev) => !prev)
  const closeMobileMenu = () => setMobileOpen(false)

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans antialiased text-[#212121]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileMenu}
      />
      <Header onToggleMobileMenu={toggleMobileMenu} collapsed={collapsed} />

      <main
        className={`transition-all duration-300 ease-in-out pt-16 min-h-screen ${
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
        } pl-0`}
      >
        <div className="mx-auto max-w-7xl p-4 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
