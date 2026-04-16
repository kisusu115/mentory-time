import { useEffect, useState } from 'react'
import { useStore } from './store'
import { saveCredentials, loadCredentials, clearCredentials } from '../lib/crypto'

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saveLogin, setSaveLogin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 저장된 자격증명 복원
  useEffect(() => {
    loadCredentials().then((cred) => {
      if (cred) {
        setUsername(cred.username)
        setPassword(cred.password)
        setSaveLogin(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError(null)
    const result = await login(username, password)
    setLoading(false)
    if (result.success) {
      if (saveLogin) {
        await saveCredentials(username, password)
      } else {
        await clearCredentials()
      }
      onSuccess()
    } else {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 py-4">
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        SW마에스트로 로그인이 필요합니다.<br />
        만약 여기서 로그인이 되지 않는 경우,{' '}
        <a href="https://www.swmaestro.ai/sw/member/user/forLogin.do?menuNo=200025" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
          홈페이지
        </a>
        에서 직접 로그인해주세요.
      </p>
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
      <input
        type="email"
        placeholder="이메일"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-brand-500"
        autoComplete="email"
        required
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-brand-500"
        autoComplete="current-password"
        required
      />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={saveLogin}
          onChange={(e) => setSaveLogin(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-[10px] text-gray-500">아이디/비밀번호 저장</span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="px-3 py-2 text-xs bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors disabled:opacity-50"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>
      <p className="text-[9px] text-gray-400 text-center leading-relaxed">
        ID, PW는 AES-256-GCM으로 암호화하여<br />사용자 브라우저에만 저장됩니다.
      </p>
    </form>
  )
}
