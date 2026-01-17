import React from 'react'
import ReactDOM from 'react-dom/client'
import Options from './Options'
import '../i18n/config'
import '../index.css'

const getInitialTheme = (): 'light' | 'dark' => {
  let savedTheme: string | null = null
  try {
    savedTheme = localStorage.getItem('theme')
  } catch {
    savedTheme = null
  }
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

document.documentElement.classList.remove('light', 'dark')
document.documentElement.classList.add(getInitialTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
)
