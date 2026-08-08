import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const existing = await db.odp.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'ODP not found' }, { status: 404 })
    }

    // Build change log
    const changes: { field: string; oldValue: string; newValue: string }[] = []
    for (const [key, value] of Object.entries(updateData)) {
      const oldVal = String(existing[key as keyof typeof existing] ?? '')
      const newVal = String(value ?? '')
      if (oldVal !== newVal) {
        changes.push({ field: key, oldValue: oldVal, newValue: newVal })
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ message: 'No changes detected', odp: existing })
    }

    // Update ODP
    const updated = await db.odp.update({
      where: { id },
      data: updateData,
    })

    // Log changes
    for (const change of changes) {
      await db.odpChangeLog.create({
        data: {
          odpId: id,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedBy: body.changedBy || 'web-user',
        },
      })
    }

    return NextResponse.json({
      message: 'ODP updated successfully',
      odp: updated,
      changes,
    })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update ODP' }, { status: 500 })
  }
}
