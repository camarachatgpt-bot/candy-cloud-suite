export function calcularRateioCustosFixos(custosFixosMensais: number, metaMensalVendasUnidades: number): number {
  if (metaMensalVendasUnidades <= 0) {
    return 0;
  }

  return custosFixosMensais / metaMensalVendasUnidades;
}

export function calcularCustoTotal(custoVariavel: number, rateioCustosFixos: number): number {
  return custoVariavel + rateioCustosFixos;
}

export function calcularMargem(precoVenda: number, custoTotal: number): number {
  if (precoVenda <= 0) {
    return 0;
  }

  return ((precoVenda - custoTotal) / precoVenda) * 100;
}

export function calcularPrecoReferencia(custoTotal: number, margemDesejada: number): number {
  const margemDesejadaPercentual = Math.max(0, margemDesejada);

  if (margemDesejadaPercentual >= 100) {
    return custoTotal;
  }

  return custoTotal / (1 - margemDesejadaPercentual / 100);
}
