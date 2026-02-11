
import { Process, ProjectParameters } from '../types';
import { TemplateService } from './supabase';

export const generateOfficialDocument = async (process: Process, auditParams: ProjectParameters | null, backgroundUrl?: string) => {
  const date = new Date().toLocaleDateString('pt-BR');
  const year = new Date().getFullYear();
  
  // DADOS DO PROCESSO
  const protocol = process.protocol_number || '00000';
  const address = process.address_work || 'Endereço não informado';
  const owner = process.applicants?.name || 'Nome do Proprietário';
  const docId = process.applicants?.cpf || 'CPF/CNPJ';
  const type = process.type || 'Processo';
  
  // DADOS DA IA
  const area = auditParams?.area_total ? auditParams.area_total.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : "0,00"; 
  const areaExtenso = auditParams?.area_total ? "extenso a preencher" : "zero"; 
  const units = "01";
  const numPav = "01";
  
  // 1. Determina o Tipo de Template
  let templateType: 'HABITE_SE' | 'ALVARA' | 'ANUENCIA' = 'ALVARA';
  let docTitle = 'ALVARÁ DE LICENÇA';

  if (process.type === 'HABITE_SE' || process.type.includes('Habite-se')) {
      templateType = 'HABITE_SE';
      docTitle = 'HABITE-SE';
  } else if (process.status === 'ANUENCIA_EMITIDA') {
      templateType = 'ANUENCIA';
      docTitle = 'ANUÊNCIA AMBIENTAL';
  }

  // 2. Busca o Texto do Banco (ou usa fallback)
  let content = '';
  try {
      const tmpl = await TemplateService.getTemplate(templateType);
      if (tmpl && tmpl.content) {
          content = tmpl.content;
      }
  } catch (e) { console.warn("Usando template padrão devido a erro no banco."); }

  // Fallback se não tiver no banco
  if (!content) {
      if (templateType === 'HABITE_SE') {
          content = `<p class="protocol-num">Nº #PROTOCOLO/#ANO_PROTO</p><p class="main-text">Fica concedido o HABITE-SE para o imóvel situado à <strong>#ENDERECO</strong>.</p><p class="main-text">Proprietário: <strong>#PROPRIETARIO</strong>.</p><p class="date-line">Petrolina/PE, #DATA</p>`;
      } else {
          content = `<p class="protocol-num">ALVARÁ Nº #PROTOCOLO</p><p class="main-text">Autoriza-se a construção no endereço <strong>#ENDERECO</strong>.</p><p class="main-text">Interessado: <strong>#PROPRIETARIO</strong>.</p><p class="date-line">Petrolina/PE, #DATA</p>`;
      }
  }

  // 3. Substituição de Tags
  const replacements: Record<string, string> = {
      '#PROTOCOLO': protocol,
      '#ANO_PROTO': year.toString(),
      '#ENDERECO': address,
      '#PROPRIETARIO': owner,
      '#CPF_CNPJ': docId,
      '#TIPO': type,
      '#AREA': area,
      '#AREA_EXTENSO': areaExtenso,
      '#DATA': date,
      '#NOME_AUTOR': '[AUTOR]', 
      '#NOME_RESP': '[RESPONSAVEL]'
  };

  let finalHtml = content;
  Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(key, 'g');
      finalHtml = finalHtml.replace(regex, value);
  });

  // 4. HTML Final para Impressão
  // MUDANÇA TÉCNICA: Usamos <img> com object-fit: fill para garantir que não haja zoom
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle} - ${protocol}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
        
        body { 
            font-family: 'Times New Roman', serif; 
            margin: 0; padding: 0;
            width: 210mm; height: 297mm;
            color: #000;
            position: relative;
        }
        
        /* Imagem de Fundo Forçada com FILL para não dar Zoom */
        #bg-layer {
            position: fixed;
            top: 0; left: 0;
            width: 210mm; height: 297mm;
            z-index: -1;
        }
        #bg-layer img {
            width: 100%;
            height: 100%;
            object-fit: fill; /* Força preencher a folha exata sem cortar ou zoom */
        }

        .page-content {
            position: relative;
            z-index: 1;
            /* MARGENS REDUZIDAS PARA GANHAR ESPAÇO */
            padding-top: 50mm;
            padding-left: 30mm;
            padding-right: 20mm;
            padding-bottom: 25mm;
        }

        /* RESET AGRESSIVO DE PARÁGRAFOS DENTRO DO BLOCO DE ASSINATURA */
        /* Detecta o container grid de assinatura criado pelo editor */
        div[style*="display: grid"] {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            page-break-inside: avoid;
            gap: 20px !important;
            margin-bottom: 0 !important;
        }
        
        /* Reseta margens internas de CADA DIV DENTRO da assinatura */
        div[style*="display: grid"] div {
             margin: 0 !important;
             padding: 0 !important;
             line-height: 1.1 !important; /* Força linhas bem juntas */
        }

        @media print { 
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
        }
      </style>
    </head>
    <body>
      <div id="bg-layer">
          <img src="${backgroundUrl || ''}" alt="Papel Timbrado" />
      </div>
      <div class="page-content">
          ${finalHtml}
      </div>
      <script>
        // Aguarda a imagem carregar antes de imprimir
        window.onload = () => { 
            const img = document.querySelector('img');
            if(img && !img.complete) {
                img.onload = () => setTimeout(() => window.print(), 500);
            } else {
                setTimeout(() => window.print(), 500); 
            }
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (win) {
    win.document.write(fullHtml);
    win.document.close();
  } else {
    alert('Pop-up bloqueado. Permita pop-ups para gerar o documento.');
  }
};
