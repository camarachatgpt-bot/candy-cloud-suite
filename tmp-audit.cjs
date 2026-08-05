const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ttzcukhopmrktnfluimg.supabase.co', 'sb_publishable_wFjedV-hm4JRpNZdURsryA_XjkVxbr1');

(async () => {
  const [{ data: movimentos, error: movErr }, { data: compras, error: compErr }, { data: vendas, error: vendErr }, { data: ingredientes, error: ingErr }] = await Promise.all([
    supabase.from('movimentacoes_estoque').select('id, origem, documento, ingrediente_id'),
    supabase.from('compras').select('id'),
    supabase.from('vendas').select('id'),
    supabase.from('ingredientes').select('id')
  ]);

  console.log(JSON.stringify({ movErr, compErr, vendErr, ingErr }, null, 2));
  const compraIds = new Set((compras || []).map((x) => String(x.id)));
  const vendaIds = new Set((vendas || []).map((x) => String(x.id)));
  const ingredienteIds = new Set((ingredientes || []).map((x) => String(x.id)));

  const orfaos = (movimentos || []).filter((m) => {
    const origem = String(m.origem || '');
    const documento = String(m.documento || '');
    const ingredienteId = String(m.ingrediente_id || '');

    if (origem === 'Compra') {
      const compraId = documento.replace(/^compra-/, '');
      return !compraIds.has(compraId);
    }
    if (origem === 'Venda') {
      const vendaId = document.replace(/^venda-/, '');
      return !vendaIds.has(vendaId);
    }

    return !ingredienteIds.has(ingredienteId);
  });

  console.log('total movimentos', (movimentos || []).length);
  console.log('orfaos', orfaos.length);
  console.log(JSON.stringify(orfaos.slice(0, 50), null, 2));
})();
