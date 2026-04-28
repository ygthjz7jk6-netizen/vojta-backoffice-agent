'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { ApprovalRequest } from '@/types'

interface Props {
  request: ApprovalRequest
  onConfirm: () => void
  onCancel: () => void
}

export function ApprovalModal({ request, onConfirm, onCancel }: Props) {
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
          <p className="text-sm text-gray-600 mb-3">{request.description}</p>
          {request.type === 'email' && !!request.data.draft && (
            <pre className="bg-gray-50 border rounded-lg p-3 text-xs whitespace-pre-wrap text-gray-700 max-h-48 overflow-y-auto">
              {String(request.data.draft)}
            </pre>
          )}
          {request.type === 'schedule' && (
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">Akce:</span> {String(request.data.action_type)}</p>
              <p><span className="font-medium">Čas:</span> {String(request.data.next_run_human)}</p>
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
