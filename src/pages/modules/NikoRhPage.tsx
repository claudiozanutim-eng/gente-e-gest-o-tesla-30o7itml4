import React from 'react'
import { Sparkles, BookOpen, Scale, ShieldCheck, Zap } from 'lucide-react'
import { NikoChatInterface } from '@/components/chat/NikoChatInterface'
import { NIKO_ROBOT_AVATAR_URL } from '@/lib/nikoAsset'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function NikoRhPage() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E0E0E0]">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-[#0D47A1]/30 p-1 shadow-sm shrink-0">
              <img
                src={NIKO_ROBOT_AVATAR_URL}
                alt="NIKO RH"
                loading="lazy"
                className="h-full w-full object-contain drop-shadow-xs"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#212121]">
                  NIKO RH — Assistente Virtual
                </h1>
                <Badge className="bg-[#E8EEF7] text-[#0D47A1] border-[#0D47A1]/20 font-semibold text-xs">
                  IA Nativa Skip Cloud
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-[#757575]">
                Especialista em Legislação Trabalhista Brasileira (CLT), Cultura Tesla e orientação
                aos colaboradores
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Destaque */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Disponível 24/7
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0D47A1] text-xs font-semibold">
            <Zap className="h-3.5 w-3.5" />
            Tesla Mecatrônica
          </div>
        </div>
      </div>

      {/* Grid: Chat Principal + Card Lateral de Conhecimento e Princípios */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Painel Central com a Interface de Chat Completa */}
        <div className="lg:col-span-3 h-[740px] max-h-[82vh] flex flex-col">
          <NikoChatInterface className="h-full shadow-md" />
        </div>

        {/* Sidebar Informativa / Guia Rápido */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0D47A1] uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                Sobre o NIKO
              </div>
              <p className="text-xs text-[#616161] leading-relaxed">
                NIKO é a abreviação afetuosa de <strong>Nikola Tesla</strong>, patrono e inspiração
                da nossa jornada de inovação. Criado para ser o braço direito de cada membro da
                Tesla Mecatrônica.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E0E0E0] bg-white shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#212121] uppercase tracking-wider">
                <BookOpen className="h-4 w-4 text-[#0D47A1]" />
                Áreas de Conhecimento
              </div>
              <ul className="text-xs text-[#616161] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#0D47A1] font-bold">•</span>
                  <span>
                    <strong>CLT Consolidada:</strong> férias, prazos concessivos, jornada 44h, horas
                    extras e rescisão.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0D47A1] font-bold">•</span>
                  <span>
                    <strong>Cultura Tesla:</strong> autonomia com responsabilidade, dados vencem
                    opiniões, inovação.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0D47A1] font-bold">•</span>
                  <span>
                    <strong>Direitos & Deveres:</strong> atestados em até 48h, conduta ética,
                    benefícios e segurança.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border border-amber-200 bg-amber-50/60 shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Scale className="h-4 w-4 text-amber-700" />
                Aviso Legal & Ético
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                As respostas são fornecidas para fins educacionais e operacionais. O NIKO RH não
                substitui o atendimento humano do RH e não constitui consultoria jurídica formal.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[#E0E0E0] bg-[#FAFAFA] shadow-xs">
            <CardContent className="p-4 space-y-2 text-xs text-[#757575]">
              <div className="flex items-center gap-1.5 font-semibold text-[#212121]">
                <ShieldCheck className="h-4 w-4 text-[#0D47A1]" />
                Privacidade Garantida
              </div>
              <p className="text-[11px] leading-relaxed">
                O assistente responde com conhecimento geral e institucional. Suas conversas são
                vinculadas apenas à sua conta de usuário de forma estritamente isolada e segura.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
