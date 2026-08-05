import test from "node:test";
import assert from "node:assert/strict";

import { normalizarStatusParaDb } from "./status";

test("normaliza status de contas a pagar para valores aceitos pelo banco", () => {
  assert.equal(normalizarStatusParaDb("pago", "pagar"), "Pago");
  assert.equal(normalizarStatusParaDb("parcial", "pagar"), "Parcial");
  assert.equal(normalizarStatusParaDb("vencido", "pagar"), "Vencido");
  assert.equal(normalizarStatusParaDb(undefined, "pagar"), "Pendente");
});

test("normaliza status de contas a receber para valores aceitos pelo banco", () => {
  assert.equal(normalizarStatusParaDb("recebido", "receber"), "Recebido");
  assert.equal(normalizarStatusParaDb("parcial", "receber"), "Parcial");
  assert.equal(normalizarStatusParaDb("atrasado", "receber"), "Vencido");
  assert.equal(normalizarStatusParaDb("aberto", "receber"), "Pendente");
});
