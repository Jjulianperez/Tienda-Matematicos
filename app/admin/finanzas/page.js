'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineBanknotes,
  HiOutlineShoppingBag,
  HiOutlineReceiptPercent,
  HiOutlineCube,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineMinus,
  HiOutlineInformationCircle,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
} from 'react-icons/hi2'
import AdminLayout from '@/components/admin/AdminLayout'
import { useToast, ToastStack } from '@/components/Modal'
import LoadingModal from '@/components/ui/LoadingModal'
import { formatMoney, formatDateTime, percentChange } from '@/lib/format'

const STATUS_META = {
  confirmed: { label: 'Confirmadas', cls: 'badge-stock', counts: true },
  pending: { label: 'Pendientes', cls: 'badge-celeste', counts: false },
  cancelled: { label: 'Canceladas', cls: 'badge-sinstock', counts: false },
}

const MONTH_SHORT = new Intl.DateTimeFormat('es-AR', { month: 'short' })

function monthShort(key) {
  const [year, month] = key.split('-').map(Number)
  // Día 15: punto medio del mes, no se corre por zona horaria.
  return MONTH_SHORT.format(new Date(Date.UTC(year, month - 1, 15, 12))).replace('.', '')
}

function KpiCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const toneCls = {
    default: 'text-white',
    primary: 'text-primary-light',
    warning: 'text-amber-300',
    muted: 'text-white/40',
  }[tone]

  return (
    <div className="card-dark p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="text-white/30" size={16} />
        <p className="text-[0.65rem] uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className={`text-2xl font-display font-semibold ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-white/40 mt-1.5">{sub}</p>}
    </div>
  )
}

function ChangeBadge({ current, previous }) {
  const change = percentChange(current, previous)

  if (change === null) {
    return <span className="text-xs text-white/30">Sin mes anterior para comparar</span>
  }

  const rounded = Math.round(change * 10) / 10
  const up = rounded > 0
  const flat = rounded === 0
  const Icon = flat ? HiOutlineMinus : up ? HiOutlineArrowTrendingUp : HiOutlineArrowTrendingDown
  const cls = flat ? 'text-white/40' : up ? 'text-green-400' : 'text-red-400'

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cls}`}>
      <Icon size={14} />
      {up && '+'}{rounded}% vs mes anterior
    </span>
  )
}

export default function AdminFinanzas() {
  const router = useRouter()

  const [data, setData] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const { toasts, show: showToast, dismiss } = useToast()
  const toastRef = useRef(showToast)
  useEffect(() => { toastRef.current = showToast }, [showToast])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/admin/login')
      return
    }

    let cancelled = false

    const fetchFinance = async () => {
      try {
        const res = await fetch('/api/finance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las finanzas')
        if (cancelled) return

        setData(json)
        // Se respeta el mes elegido si sigue existiendo; si no, el que sugiere
        // la API (mes actual, o el último con movimiento).
        setSelectedMonth((prev) =>
          prev && json.series.some((m) => m.month === prev) ? prev : json.default_month
        )
      } catch (err) {
        if (cancelled) return
        toastRef.current(err.message, 'error')
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchFinance()
    return () => { cancelled = true }
  }, [reloadKey, router])

  // Recarga visible: el modal solo aparece en la carga inicial y acá, que es
  // una acción explícita del usuario.
  const hardRefresh = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const series = data?.series || []
  const index = series.findIndex((m) => m.month === selectedMonth)
  const month = index >= 0 ? series[index] : null
  const previous = index > 0 ? series[index - 1] : null

  const maxRevenue = Math.max(...series.map((m) => m.revenue), 0)

  return (
    <AdminLayout title="Finanzas">
      <div className="p-4 sm:p-8 lg:p-10">
        {/* Encabezado */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-5 mb-8">
          <div>
            <h2 className="font-display font-semibold text-2xl text-white mb-1">Resumen de ventas</h2>
            <p className="text-sm text-white/40">
              Facturación por mes, calculada sobre los pedidos confirmados.
            </p>
          </div>
          <button
            onClick={hardRefresh}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <HiOutlineArrowPath size={17} />
            Actualizar
          </button>
        </div>

        {!loading && !data && (
          <div className="card-dark text-center py-20">
            <p className="text-white/40">No se pudieron cargar los datos. Probá actualizar.</p>
          </div>
        )}

        {data && month && (
          <div className="space-y-6">
            {/* Selector de mes */}
            <div className="flex flex-wrap gap-2">
              {series
                .filter((m) => m.revenue > 0 || m.orders > 0 || m.pending_count > 0 || m.cancelled_count > 0)
                .map((m) => (
                  <button
                    key={m.month}
                    onClick={() => setSelectedMonth(m.month)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      m.month === selectedMonth
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {monthShort(m.month)}
                    <span className="ml-2 text-xs opacity-60">{m.month.slice(0, 4)}</span>
                  </button>
                ))}
            </div>

            {/* KPIs del mes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                icon={HiOutlineBanknotes}
                label="Facturado"
                value={formatMoney(month.revenue)}
                tone="primary"
                sub={<ChangeBadge current={month.revenue} previous={previous?.revenue ?? 0} />}
              />
              <KpiCard
                icon={HiOutlineShoppingBag}
                label="Pedidos"
                value={month.orders}
                sub={`${month.units} ${month.units === 1 ? 'unidad' : 'unidades'} vendidas`}
              />
              <KpiCard
                icon={HiOutlineReceiptPercent}
                label="Ticket promedio"
                value={formatMoney(month.avg_ticket)}
                sub={<ChangeBadge current={month.avg_ticket} previous={previous?.avg_ticket ?? 0} />}
              />
              <KpiCard
                icon={HiOutlineCube}
                label="Mes"
                value={month.label}
                tone="muted"
                sub={selectedMonth === data.current_month ? 'Mes en curso' : 'Mes cerrado'}
              />
            </div>

            {/* Pendientes y canceladas del mes */}
            {(month.pending_count > 0 || month.cancelled_count > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {month.pending_count > 0 && (
                  <div className="rounded-2xl bg-celeste/10 border border-celeste/20 p-5">
                    <p className="text-sm text-celeste/80 mb-1">Consultas sin confirmar</p>
                    <p className="text-xl font-display font-semibold text-white">
                      {formatMoney(month.pending_amount)}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {month.pending_count} {month.pending_count === 1 ? 'pedido pendiente' : 'pedidos pendientes'}.
                      Todavía no es plata cobrada.
                    </p>
                  </div>
                )}
                {month.cancelled_count > 0 && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5">
                    <p className="text-sm text-red-300/80 mb-1">Cancelado</p>
                    <p className="text-xl font-display font-semibold text-white">
                      {formatMoney(month.cancelled_amount)}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {month.cancelled_count} {month.cancelled_count === 1 ? 'pedido cancelado' : 'pedidos cancelados'}.
                      No cuenta en la facturación.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Gráfico de barras */}
            <section className="card-dark p-6 sm:p-7">
              <h3 className="font-display font-semibold text-white mb-1">Evolución mensual</h3>
              <p className="text-xs text-white/40 mb-6">
                Los meses sin ventas se muestran en cero, no se saltean.
              </p>

              {maxRevenue === 0 ? (
                <p className="text-sm text-white/40 py-10 text-center">
                  Todavía no hay ventas confirmadas para graficar.
                </p>
              ) : (
                <div className="flex items-end gap-1.5 sm:gap-2.5 h-48">
                  {series.map((m) => {
                    const height = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
                    const active = m.month === selectedMonth
                    return (
                      <button
                        key={m.month}
                        onClick={() => setSelectedMonth(m.month)}
                        title={`${m.label}: ${formatMoney(m.revenue)}`}
                        className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2 h-full group"
                      >
                        <span className="text-[0.6rem] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                          {m.revenue > 0 ? formatMoney(m.revenue) : ''}
                        </span>
                        <span
                          className={`w-full rounded-t-md transition-colors ${
                            active ? 'bg-primary' : 'bg-primary/25 group-hover:bg-primary/50'
                          }`}
                          style={{ height: `${Math.max(height, m.revenue > 0 ? 3 : 0.5)}%` }}
                        />
                        <span className={`text-[0.65rem] ${active ? 'text-primary-light' : 'text-white/30'}`}>
                          {monthShort(m.month)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top productos del mes */}
              <section className="card-dark p-6 sm:p-7">
                <h3 className="font-display font-semibold text-white mb-1">Más vendidos — {month.label}</h3>
                <p className="text-xs text-white/40 mb-5">Solo pedidos confirmados.</p>

                {month.top_products.length === 0 ? (
                  <p className="text-sm text-white/40 py-8 text-center">Sin ventas este mes.</p>
                ) : (
                  <div className="space-y-3">
                    {month.top_products.map((product) => (
                      <div key={product.product_id || product.name} className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/80 truncate">{product.name}</p>
                          <p className="text-xs text-white/30">
                            {product.units} {product.units === 1 ? 'unidad' : 'unidades'}
                            {product.deleted && (
                              <span className="ml-2 text-amber-400/70">producto eliminado del catálogo</span>
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-white shrink-0">
                          {formatMoney(product.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Desglose por estado */}
              <section className="card-dark p-6 sm:p-7">
                <h3 className="font-display font-semibold text-white mb-1">Totales históricos</h3>
                <p className="text-xs text-white/40 mb-5">
                  Todo el período cargado, no solo el mes elegido.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Facturado</p>
                    <p className="text-xl font-display font-semibold text-primary-light">
                      {formatMoney(data.totals.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-widest text-white/40 mb-1">Pedidos</p>
                    <p className="text-xl font-display font-semibold text-white">{data.totals.orders}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {data.by_status.map((entry) => {
                    const meta = STATUS_META[entry.status] || { label: entry.status, cls: 'badge-celeste' }
                    return (
                      <div key={entry.status} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={`badge ${meta.cls}`}>{meta.label}</span>
                          <span className="text-xs text-white/30 truncate">
                            {entry.orders} {entry.orders === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        </span>
                        <span className={`text-sm shrink-0 ${entry.counts_as_revenue ? 'text-white' : 'text-white/40 line-through'}`}>
                          {formatMoney(entry.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Notas y calidad de datos */}
            <section className="card-dark p-6 sm:p-7 space-y-4">
              <div className="flex items-start gap-3">
                <HiOutlineInformationCircle className="text-primary-light shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm text-white/80 mb-1">Esto es facturación, no ganancia</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Se suma lo que se cobró por las ventas confirmadas. Para saber cuánto te queda
                    hace falta cargar el costo de cada producto: la columna ya existe, pero todavía
                    no hay pantalla para completarla.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <HiOutlineInformationCircle className="text-white/30 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm text-white/80 mb-1">Cada venta cuenta en el mes en que se confirmó</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Si un pedido se hizo el 30 de septiembre y se confirmó el 2 de octubre, entra en
                    octubre, que es cuando entró la plata.
                  </p>
                </div>
              </div>

              {(data.data_quality.rows_without_order_number > 0 ||
                data.data_quality.lines_with_deleted_product > 0) && (
                <div className="flex items-start gap-3 pt-4 border-t border-white/5">
                  <HiOutlineExclamationTriangle className="text-amber-400/80 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm text-white/80 mb-1">Pedidos viejos con datos incompletos</p>
                    <ul className="text-xs text-white/40 leading-relaxed space-y-1">
                      {data.data_quality.rows_without_order_number > 0 && (
                        <li>
                          {data.data_quality.rows_without_order_number} líneas sin número de pedido:
                          se cuentan como pedidos separados.
                        </li>
                      )}
                      {data.data_quality.lines_with_deleted_product > 0 && (
                        <li>
                          {data.data_quality.lines_with_deleted_product} líneas cuyo producto ya no
                          existe en el catálogo. La venta se cuenta igual, con el nombre guardado.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <p className="text-xs text-white/25 text-center">
              Zona horaria {data.timezone} · actualizado {formatDateTime(new Date().toISOString())}
            </p>
          </div>
        )}
      </div>

      <LoadingModal open={loading} message="Calculando finanzas..." />
      <ToastStack toasts={toasts} onClose={dismiss} />
    </AdminLayout>
  )
}
