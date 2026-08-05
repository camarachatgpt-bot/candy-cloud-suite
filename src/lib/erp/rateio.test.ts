import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularCustoTotal,
  calcularMargem,
  calcularPrecoReferencia,
  calcularRateioCustosFixos,
} from "./rateio.ts";

test("calcula rateio por unidade a partir da meta mensal", () => {
  assert.equal(calcularRateioCustosFixos(600, 100), 6);
  assert.equal(calcularRateioCustosFixos(600, 0), 0);
});

test("calcula custo total e margem com base no rateio", () => {
  const custoTotal = calcularCustoTotal(10, 6);
  assert.equal(custoTotal, 16);
  assert.equal(calcularMargem(20, custoTotal), 20);
});

test("gera preço de referência a partir do custo total e da margem desejada", () => {
  assert.equal(calcularPrecoReferencia(16, 20), 20);
  assert.equal(calcularPrecoReferencia(20, 25), 26.666666666666668);
});
