'use client'

import { useState } from 'react'
import { Modal, Alert, Confirm, useToast } from '@/components/Modal'
import { HiOutlineTrash, HiOutlineUserPlus, HiOutlineCog } from 'react-icons/hi2'

export function ModalDemo() {
  const [alertOpen, setAlertOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const { toasts, show, dismiss } = useToast()

  const handleDelete = () => {
    show('Producto eliminado correctamente', 'success')
    setConfirmOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setAlertOpen(true)}
          className="btn-outline"
        >
          Alert Simple
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="btn-outline"
        >
          Confirmar Eliminación
        </button>
        <button
          onClick={() => setCustomModalOpen(true)}
          className="btn-outline"
        >
          Modal Personalizado
        </button>
        <button
          onClick={() => show('¡Acción completada!', 'success')}
          className="btn-primary"
        >
          Toast Success
        </button>
        <button
          onClick={() => show('Error al procesar', 'error')}
          className="btn-outline"
        >
          Toast Error
        </button>
        <button
          onClick={() => show('Nueva notificación', 'info')}
          className="btn-outline"
        >
          Toast Info
        </button>
      </div>

      <Alert
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Operación exitosa"
        message="Tu pedido ha sido procesado correctamente. Recibirás un email de confirmación en breve."
        type="success"
        confirmText="Entendido"
      />

      <Confirm
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Eliminar producto"
        message="¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="error"
      />

      <Modal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="Configuración avanzada"
        description="Personaliza las opciones según tus necesidades."
        size="lg"
        confirmText="Guardar cambios"
        cancelText="Cancelar"
        onConfirm={() => { show('Cambios guardados', 'success'); setCustomModalOpen(false); }}
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Nombre de la tienda</label>
            <input
              type="text"
              defaultValue="MateMáticos"
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Email de notificaciones</label>
            <input
              type="email"
              defaultValue="hola@matematicos.com"
              className="input-dark"
            />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="notifications" defaultChecked className="w-5 h-5 rounded border-white/20 text-primary focus:ring-primary/20" />
            <label htmlFor="notifications" className="text-sm text-white/80">Recibir notificaciones por email</label>
          </div>
        </div>
      </Modal>

      {toasts.map(toast => (
        <Modal.Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => dismiss(toast.id)}
        />
      ))}
    </div>
  )
}