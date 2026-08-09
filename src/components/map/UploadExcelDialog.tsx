'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const COLUMN_MAP: Record<string, string> = {
  'code': 'code', 'name': 'name', 'kelurahan': 'kelurahan',
  'kecamatan': 'kecamatan', 'city': 'city', 'region': 'region', 'province': 'province',
  'address_match': 'addressMatch', 'addressmatch': 'addressMatch',
  'district_name': 'districtName', 'districtname': 'districtName',
  'partner_name': 'partnerName', 'partnername': 'partnerName',
  'check_status': 'checkStatus', 'checkstatus': 'checkStatus',
  'capacity': 'capacity', 'total_assigned': 'totalAssigned', 'totalassigned': 'totalAssigned',
  'active': 'active', 'terminate': 'terminate', 'undetected': 'undetected',
  'availability': 'availability', 'available_cnt': 'availableCnt', 'availablecnt': 'availableCnt',
  'olt_ip': 'oltIp', 'oltip': 'oltIp', 'onu_card': 'onuCard', 'onucard': 'onuCard',
  'status': 'status', 'location_type': 'locationType', 'locationtype': 'locationType',
  'odc_code': 'odcCode', 'odccode': 'odcCode', 'odc_name': 'odcName', 'odcname': 'odcName',
  'odc_port_no': 'odcPortNo', 'odcportno': 'odcPortNo',
  'rfs_date': 'rfsDate', 'rfsdate': 'rfsDate',
  'address': 'address', 'coordinate': 'coordinate',
  'latitude': 'latitude', 'longitude': 'longitude',
  'install_status': 'installStatus', 'installstatus': 'installStatus',
  'usage_for': 'usageFor', 'usagefor': 'usageFor',
  'vendor': 'vendor', 'description': 'description',
  'odp_owner': 'odpOwner', 'odpowner': 'odpOwner', 'provider': 'provider',
  'modify_date': 'modifyDate', 'modifydate': 'modifyDate',
  'modify_by': 'modifyBy', 'modifyby': 'modifyBy',
  'create_date': 'createDate', 'createdate': 'createDate',
  'create_by': 'createBy', 'createby': 'createBy',
  'created_at': 'createdAt', 'createdat': 'cre
