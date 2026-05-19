import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const router = useRouter()

  async function handleSubmit(e){
    e.preventDefault(); setLoading(true)
    const res = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
    if(res.ok) router.push('/diary')
    else alert('Login failed')
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Log in</h2>
        <label className="block mb-2">Email
          <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full mt-1 p-2 rounded" type="email" required />
        </label>
        <label className="block mb-2">Password
          <input value={password} onChange={e=>setPassword(e.target.value)} className="w-full mt-1 p-2 rounded" type="password" required />
        </label>
        <button className="mt-4 px-4 py-2" style={{background:'#b79362',color:'#fff'}} disabled={loading}>{loading? '...' : 'Log in'}</button>
      </form>
    </div>
  )
}
