'use client'

import { useState } from 'react'
import { HiOutlineShieldCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2'
import { verifyDraw } from '@/lib/giveaways/draw'

// Comprueba en el navegador, con los datos públicos del sorteo, que el
// resultado sea el que sale de la semilla comprometida y de la lista congelada.
// No depende de que el servidor "diga" que está bien: recalcula todo acá.
//
// `data` es la respuesta de /api/giveaways/public/[slug].
export default function VerifyDraw({ data }) {
  const [state, setState] = useState({ status: 'idle', problems: [] })

  const verification = data?.verification
  if (!verification?.seed_hex || !verification?.results) return null

  const run = async () => {
    setState({ status: 'running', problems: [] })
    try {
      const result = await verifyDraw({
        seedHex: verification.seed_hex,
        seedCommitmentHex: verification.seed_commitment,
        ticketsHashHex: verification.tickets_hash,
        tickets: verification.tickets,
        winnersCount: data.giveaway.winners_count,
        alternatesCount: data.giveaway.alternates_count,
        results: verification.results,
      })
      setState({ status: result.ok ? 'ok' : 'failed', problems: result.problems })
    } catch (error) {
      setState({ status: 'failed', problems: [error.message || 'No se pudo verificar'] })
    }
  }

  return (
    <div className="card-dark p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary-light shrink-0">
          <HiOutlineShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-white">Verificá el resultado</h3>
          <p className="text-sm text-white/50 mt-1 leading-relaxed">
            Antes de abrir el sorteo publicamos una huella de la semilla. Al cerrar, publicamos la
            huella de la lista de tickets. Con la semilla revelada, tu navegador recalcula los
            ganadores y los compara con los publicados.
          </p>

          <dl className="mt-4 space-y-2 text-xs">
            <div>
              <dt className="text-white/40 uppercase tracking-widest">Compromiso de la semilla</dt>
              <dd className="font-mono text-white/70 break-all">{verification.seed_commitment}</dd>
            </div>
            <div>
              <dt className="text-white/40 uppercase tracking-widest">Huella de los tickets</dt>
              <dd className="font-mono text-white/70 break-all">{verification.tickets_hash}</dd>
            </div>
            <div>
              <dt className="text-white/40 uppercase tracking-widest">Algoritmo</dt>
              <dd className="font-mono text-white/70">{verification.algorithm}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={run}
            disabled={state.status === 'running'}
            className="btn-outline mt-5"
          >
            {state.status === 'running' ? 'Verificando...' : 'Verificar ahora'}
          </button>

          {state.status === 'ok' && (
            <p className="mt-4 flex items-center gap-2 text-sm text-primary-light" role="status">
              <HiOutlineShieldCheck size={18} />
              Verificado: el resultado coincide con la semilla y la lista publicadas.
            </p>
          )}
          {state.status === 'failed' && (
            <div className="mt-4 text-sm text-red-400" role="alert">
              <p className="flex items-center gap-2 font-medium">
                <HiOutlineExclamationTriangle size={18} />
                La verificación falló
              </p>
              <ul className="list-disc ml-6 mt-1 space-y-0.5">
                {state.problems.map(problem => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
