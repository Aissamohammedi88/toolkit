ts
export interface Stage {
  name: string;
  image: string;
  commands: string[];
  when?: string; // condition
}

export interface Pipeline {
  name: string;
  stages: Stage[];
}
