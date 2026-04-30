'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

// Approval request přichází přímo jako tool result — pole jsou na vrchní úrovni
type ApprovalData = Record<string, unknown>

interface Props {
  request: ApprovalData
  onConfirm: () => void
  onCancel: () => void
}

export function ApprovalModal({ request, onConfirm, onCancel }: Props) {
  const type = request.type as string
  const description = request.description as string | undefined

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Potvrzení akce
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {description && <p className="text-sm text-gray-600 mb-3">{description}</p>}

          {type === 'email' && !!request.draft && (
            <pre className="bg-gray-50 border rounded-lg p-3 text-xs whitespace-pre-wrap text-gray-700 max-h-48 overflow-y-auto">
              {String(request.draft)}
            </pre>
          )}

          {type === 'schedule' && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">Akce:</span> {String(request.action_type ?? '')}</p>
              <p><span className="font-medium">Čas:</span> {String(request.next_run_human ?? '')}</p>
            </div>
          )}

          {type === 'monitoring' && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">Lokalita:</span> {String(request.location_name ?? '')}</p>
              <p><span className="font-medium">Typ:</span> {request.category_type === 2 ? 'Pronájem' : 'Prodej'} · {request.category_main === 2 ? 'domy' : 'byty'}</p>
              <p><span className="font-medium">Notifikace:</span> každý den v 8:05</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Zrušit</Button>
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
            Potvrdit a provést
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
