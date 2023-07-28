import { CodecEntry, Ast } from "./lookups"

interface Variable {
  id: string
  types?: string
  value: string
  directDependencies: Set<string>
}
interface CodeDeclarations {
  imports: Set<string>
  variables: Map<string, Variable>
  lookupToVariableId: Map<number, string>
}

const _buildSynax = (
  input: CodecEntry,
  declarations: CodeDeclarations,
): CodeDeclarations => {
  if (declarations.lookupToVariableId.has(input.id)) {
    return declarations
  }

  if (input.type === "primitive") {
    declarations.imports.add(input.value)
    declarations.lookupToVariableId.set(input.id, input.value)
    return declarations
  }

  if (input.type === "compact") {
    const importVal = input.isBig ? "compactBn" : "compactNumber"
    declarations.imports.add(importVal)
    declarations.lookupToVariableId.set(input.id, importVal)
    return declarations
  }

  if (input.type === "pointer") {
    _buildSynax(input.value, declarations)
    const actualVariableId = declarations.lookupToVariableId.get(
      input.value.id,
    )!
    declarations.lookupToVariableId.set(input.id, actualVariableId)
    return declarations
  }

  if (
    input.type === "bitSequence" ||
    (input.type === "sequence" &&
      input.value.type === "primitive" &&
      input.value.value === "u8")
  ) {
    declarations.imports.add("Bytes")
    const variable = {
      id: "_bytesSeq",
      value: "Bytes()",
      directDependencies: new Set<string>(),
    }
    declarations.variables.set(variable.id, variable)
    declarations.lookupToVariableId.set(input.id, variable.id)
    return declarations
  }

  if (input.type === "array") {
    if (input.value.type === "primitive" && input.value.value === "u8") {
      declarations.imports.add("Bytes")
      const variable = {
        id: input.name,
        value: `Bytes(${input.len})`,
        directDependencies: new Set<string>(),
      }
      declarations.variables.set(variable.id, variable)
      declarations.lookupToVariableId.set(input.id, variable.id)
      return declarations
    }

    declarations.imports.add("Vector")
    _buildSynax(input.value, declarations)
    const dependsVar = declarations.lookupToVariableId.get(input.value.id)!
    const variable = {
      id: input.name,
      value: `Vector(${dependsVar}, ${input.len})`,
      directDependencies: new Set<string>([dependsVar]),
    }
    declarations.variables.set(variable.id, variable)
    declarations.lookupToVariableId.set(input.id, variable.id)
    return declarations
  }

  if (input.type === "sequence") {
    declarations.imports.add("Vector")
    _buildSynax(input.value, declarations)
    const dependsVar = declarations.lookupToVariableId.get(input.value.id)!
    const variable = {
      id: input.name,
      value: `Vector(${dependsVar})`,
      directDependencies: new Set<string>([dependsVar]),
    }
    declarations.variables.set(variable.id, variable)
    declarations.lookupToVariableId.set(input.id, variable.id)
    return declarations
  }

  if (input.type === "tuple") {
    declarations.imports.add("Tuple")
    input.value.forEach((x) => _buildSynax(x, declarations))
    const deps = input.value.map(
      (x) => declarations.lookupToVariableId.get(x.id)!,
    )
    const variable = {
      id: input.name,
      value: `Tuple(${deps.join(", ")})`,
      directDependencies: new Set(deps),
    }

    declarations.variables.set(variable.id, variable)
    declarations.lookupToVariableId.set(input.id, variable.id)
    return declarations
  }

  if (input.type === "struct") {
    declarations.imports.add("Struct")
    Object.values(input.value).forEach((x) => _buildSynax(x, declarations))
    const deps = Object.values(input.value).map(
      (x) => declarations.lookupToVariableId.get(x.id)!,
    )
    const variable = {
      id: input.name,
      value: `Struct({${Object.keys(input.value)
        .map((key, idx) => `${key}: ${deps[idx]}`)
        .join(", ")}})`,

      directDependencies: new Set(deps),
    }

    declarations.variables.set(variable.id, variable)
    declarations.lookupToVariableId.set(input.id, variable.id)
    return declarations
  }

  if (input.type === "enum") {
    return declarations
  }
}
