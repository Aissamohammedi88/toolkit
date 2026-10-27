#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚛️ PROTON-CALC TOOL — Moteur Mathématique & Générateur de Code
Auteur: Aissa Mohammedi (DGK)
Licence : NEXUS-PROTON-1.0
"""

import math
import cmath
import statistics
import ast
import operator
from typing import Any, Dict, List, Union

# ═══════════════════════════════════════════════════════════════════════════════
# 1. ÉVALUATEUR SÉCURISÉ (AST)
# ═══════════════════════════════════════════════════════════════════════════════

class SafeMathEvaluator:
    """Évaluateur mathématique basé sur l'AST. Zéro accès aux builtins."""

    _BIN_OPS = {
        ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod, ast.Pow: operator.pow, ast.BitXor: operator.xor,
    }

    _UNARY_OPS = {
        ast.UAdd: operator.pos, ast.USub: operator.neg, ast.Not: operator.not_,
    }

    _FONCTIONS = {
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "asin": math.asin, "acos": math.acos, "atan": math.atan,
        "sinh": math.sinh, "cosh": math.cosh, "tanh": math.tanh,
        "degrees": math.degrees, "radians": math.radians,
        "sqrt": math.sqrt, "exp": math.exp, "log": math.log,
        "log10": math.log10, "log2": math.log2,
        "floor": math.floor, "ceil": math.ceil, "trunc": math.trunc,
        "round": round, "abs": abs,
        "mean": statistics.mean, "median": statistics.median,
        "mode": statistics.mode, "stdev": statistics.stdev, "variance": statistics.variance,
        "factorial": math.factorial, "perm": math.perm, "comb": math.comb,
        "gcd": math.gcd, "lcm": math.lcm,
        "min": min, "max": max, "sum": sum, "pow": pow,
    }

    _CONSTANTS = {
        "pi": math.pi, "e": math.e, "tau": math.tau, "inf": math.inf, "nan": math.nan,
    }

    @classmethod
    def evaluate(cls, expression: str) -> Any:
        """Évalue une expression mathématique en toute sécurité."""
        try:
            tree = ast.parse(expression, mode='eval')
            return cls._eval_node(tree.body)
        except Exception as e:
            return f"Erreur: {str(e)}"

    @classmethod
    def _eval_node(cls, node: ast.AST) -> Any:
        if isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.Name):
            if node.id in cls._CONSTANTS:
                return cls._CONSTANTS[node.id]
            raise ValueError(f"Nom inconnu: {node.id}")
        elif isinstance(node, ast.BinOp):
            op = cls._BIN_OPS.get(type(node.op))
            if not op:
                raise ValueError(f"Opérateur non supporté: {type(node.op).__name__}")
            return op(cls._eval_node(node.left), cls._eval_node(node.right))
        elif isinstance(node, ast.UnaryOp):
            op = cls._UNARY_OPS.get(type(node.op))
            if not op:
                raise ValueError(f"Opérateur unaire non supporté: {type(node.op).__name__}")
            return op(cls._eval_node(node.operand))
        elif isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            func = cls._FONCTIONS.get(func_name)
            if not func:
                raise ValueError(f"Fonction non supportée: {func_name}")
            args = [cls._eval_node(arg) for arg in node.args]
            return func(*args)
        elif isinstance(node, ast.List):
            return [cls._eval_node(e) for e in node.elts]
        elif isinstance(node, ast.Tuple):
            return tuple(cls._eval_node(e) for e in node.elts)
        else:
            raise ValueError(f"Nœud non supporté: {type(node).__name__}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. VÉRIFICATEUR MATHÉMATIQUE
# ═══════════════════════════════════════════════════════════════════════════════

class MathVerifier:
    """Permet de vérifier si un résultat correspond à une expression."""

    @staticmethod
    def verify_expression(expression: str, expected_result: Union[int, float, str], tolerance: float = 1e-9) -> Dict[str, Any]:
        actual = SafeMathEvaluator.evaluate(expression)
        if isinstance(actual, str) and actual.startswith("Erreur"):
            return {"valid": False, "error": actual, "expression": expression}
        try:
            expected = float(expected_result)
            actual_float = float(actual)
            diff = abs(actual_float - expected)
            if diff <= tolerance:
                return {"valid": True, "expression": expression, "actual": actual, "expected": expected, "diff": diff}
            else:
                return {"valid": False, "expression": expression, "actual": actual, "expected": expected, "diff": diff, "error": f"Écart trop grand: {diff}"}
        except ValueError:
            return {"valid": actual == expected_result, "actual": actual, "expected": expected_result}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. GÉNÉRATEUR DE CODE
# ═══════════════════════════════════════════════════════════════════════════════

class MathCodeGenerator:
    """Transforme une formule en code Python propre."""

    @staticmethod
    def generate_from_expression(expression: str) -> str:
        py_expr = expression.replace("^", "**")
        math_funcs = ["sin", "cos", "tan", "sqrt", "log", "exp", "asin", "acos", "atan"]
        
        needs_math = any(f"{f}(" in py_expr for f in math_funcs) or "pi" in py_expr or "e" in py_expr
        
        code = ""
        if needs_math:
            code += "import math\n\n"
            for func in math_funcs:
                py_expr = py_expr.replace(f"{func}(", f"math.{func}(")
            py_expr = py_expr.replace("pi", "math.pi").replace("e", "math.e")

        code += f"# Formule : {expression}\n"
        code += f"resultat = {py_expr}\n"
        code += f"print(f'Résultat : {{resultat}}')\n"
        return code

# ═══════════════════════════════════════════════════════════════════════════════
# 4. L'OUTIL UNIFIÉ (PROTON-CALC TOOL)
# ═══════════════════════════════════════════════════════════════════════════════

class ProtonCalcTool:
    """L'interface que j'utilise pour calculer sans halluciner."""

    @staticmethod
    def get_tool_schema() -> List[Dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "calc_evaluate",
                    "description": "Évalue une expression mathématique avec une précision absolue.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string", "description": "L'expression à calculer (ex: 'sin(pi/2) + 2**10')"}
                        },
                        "required": ["expression"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "calc_verify",
                    "description": "Vérifie qu'un résultat correspond à une expression mathématique.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string"},
                            "expected_result": {"type": "string"}
                        },
                        "required": ["expression", "expected_result"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "calc_generate",
                    "description": "Génère du code Python à partir d'une expression mathématique.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string"}
                        },
                        "required": ["expression"]
                    }
                }
            }
        ]

    def execute_tool(self, name: str, args: Dict) -> Dict:
        if name == "calc_evaluate":
            expr = args.get("expression", "")
            result = SafeMathEvaluator.evaluate(expr)
            return {"expression": expr, "result": str(result)}
        elif name == "calc_verify":
            expr = args.get("expression", "")
            expected = args.get("expected_result", "")
            return MathVerifier.verify_expression(expr, expected)
        elif name == "calc_generate":
            expr = args.get("expression", "")
            return {"code": MathCodeGenerator.generate_from_expression(expr)}
        return {"error": f"Outil inconnu: {name}"}

# ═══════════════════════════════════════════════════════════════════════════════
# DÉMO (Preuve d'exécution)
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("⚛️ PROTON-CALC TOOL - Activation\n")
    tool = ProtonCalcTool()

    # Test 1 : Calcul complexe
    expr = "sqrt(16) + sin(pi/2) + log(100, 10)"
    res = tool.execute_tool("calc_evaluate", {"expression": expr})
    print(f"1. Calcul : {res['expression']} = {res['result']}")

    # Test 2 : Vérification
    verif = tool.execute_tool("calc_verify", {"expression": "2**10", "expected_result": "1024"})
    print(f"2. Vérification : {verif}")

    # Test 3 : Génération
    code = tool.execute_tool("calc_generate", {"expression": "sqrt(144) + cos(0)"})
    print(f"3. Code généré :\n{code['code']}")
