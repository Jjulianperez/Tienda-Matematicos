// Estado de cada requisito para un participante (lo que ve en su comprobante).
//
//   missing         todavía no hizo nada
//   pending_review  subió una captura y espera la revisión
//   approved        la captura fue aprobada
//   rejected        la captura fue rechazada (puede subir otra); trae el motivo
//   submitted       respondió un requisito sin archivo (declaración, texto o enlace)

export function requirementStates(requirements, evidenceRows, submissionRows) {
  // Solo cuenta el último intento de cada requisito.
  const latest = new Map()
  for (const row of evidenceRows || []) {
    const current = latest.get(row.requirement_id)
    if (!current || row.attempt_no > current.attempt_no) latest.set(row.requirement_id, row)
  }
  const submitted = new Set((submissionRows || []).map(row => row.requirement_id))

  return (requirements || []).map(requirement => {
    let state = 'missing'
    let rejectionReason = null

    if (requirement.kind === 'evidence_upload') {
      const evidence = latest.get(requirement.id)
      if (evidence) {
        state = evidence.status === 'pending' ? 'pending_review' : evidence.status
        if (evidence.status === 'rejected') rejectionReason = evidence.rejection_reason || null
      }
    } else if (submitted.has(requirement.id)) {
      state = 'submitted'
    }

    return {
      id: requirement.id,
      position: requirement.position,
      slot: requirement.slot,
      kind: requirement.kind,
      title: requirement.title,
      instructions: requirement.instructions || null,
      state,
      rejection_reason: rejectionReason,
    }
  })
}
