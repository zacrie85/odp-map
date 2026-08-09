import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const result: Record<string, any> = { steps: [] }
  result.steps.push({ step: 'env', dbUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET' })
  try {
    const count = await db.odp.count()
    result.steps.push({ step: 'count', success: true, count })
  } catch (e: any) {
    result.steps.push({ step: 'count', success: false, error: e.message, code: e.code })
  }
  try {
    const row = await db.odp.findFirst({ select: { id: true, code: true, name: true } })
    result.steps.push({ step: 'findFirst', success: true, sample: row })
  } catch (e: any) {
    result.steps.push({ step: 'findFirst', success: false, error: e.message, code: e.code })
  }
  return NextResponse.json(result)
}