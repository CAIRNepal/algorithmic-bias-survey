import React, { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

type Paper = {
  SN?: string;
  'Paper Title'?: string;
  DOI?: string;
  'Authors'?: string;
  'Author Regions'?: string;
  'Affiliations'?: string;
  Year?: string;
  'Focus Region'?: string;
  Domain?: string;
  Abstract?: string;
  [key: string]: unknown;
};

type AuthorNodeData = {
  label: string;
  region: string;
  affiliation: string;
};

type AuthorNodeProps = {
  data: AuthorNodeData;
};

interface CoAuthorNetworkGraphProps {
  papers: Paper[];
  onAuthorClick?: (author: string) => void;
}

const getColor = (region: string) => {
  // Simple color mapping for demo; you can expand this
  const colors: Record<string, string> = {
    USA: '#2563eb',
    UK: '#9333ea',
    India: '#16a34a',
    China: '#dc2626',
    Canada: '#0ea5e9',
    Australia: '#f59e42',
    Germany: '#eab308',
    France: '#f472b6',
    Spain: '#fbbf24',
    Global: '#64748b',
  };
  return colors[region] || '#8884d8';
};

// Custom node with visible author name and affiliation
const AuthorNode = ({ data }: AuthorNodeProps) => (
  <div style={{
    background: getColor(data.region),
    color: '#fff',
    border: '2px solid #fff',
    borderRadius: 8,
    padding: 8,
    fontWeight: 600,
    minWidth: 120,
    textAlign: 'center',
    cursor: 'pointer',
    lineHeight: 1.3,
  }}>
    <div style={{ fontSize: 16, fontWeight: 700 }}>{data.label}</div>
    <div style={{ fontSize: 13, fontWeight: 400, opacity: 0.92 }}>{data.affiliation}</div>
    <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
  </div>
);

// Move nodeTypes outside the component
const nodeTypes = { author: AuthorNode };

const CoAuthorNetworkGraph: React.FC<CoAuthorNetworkGraphProps> = ({ papers, onAuthorClick }) => {
  // Build nodes and edges from papers
  const { nodes, edges } = useMemo(() => {
    const authorMap = new Map<string, { region: string; affiliation: string }>();
    const edgeMap = new Map<string, { source: string; target: string; count: number }>();

    papers.forEach(paper => {
      const authors = (paper['Authors'] || '').split(';').map((a: string) => a.trim()).filter(Boolean);
      const regions = (paper['Author Regions'] || '').split(';').map((r: string) => r.trim()).filter(Boolean);
      const affiliations = (paper['Affiliations'] || '').split(';').map((a: string) => a.trim()).filter(Boolean);
      authors.forEach((author: string, idx: number) => {
        if (!authorMap.has(author)) {
          authorMap.set(author, {
            region: regions[idx] || 'Unknown',
            affiliation: affiliations[idx] || 'Unknown',
          });
        }
      });
      // Create edges for each pair of co-authors
      for (let i = 0; i < authors.length; i++) {
        for (let j = i + 1; j < authors.length; j++) {
          const key = [authors[i], authors[j]].sort().join('||');
          if (!edgeMap.has(key)) {
            edgeMap.set(key, { source: authors[i], target: authors[j], count: 0 });
          }
          edgeMap.get(key)!.count++;
        }
      }
    });
    // Layout nodes in a circle for simplicity
    const authorList = Array.from(authorMap.keys());
    const angleStep = (2 * Math.PI) / authorList.length;
    const nodes: Node[] = authorList.map((author, idx) => {
      const { region, affiliation } = authorMap.get(author)!;
      return {
        id: author,
        data: {
          label: author,
          region,
          affiliation,
        },
        position: {
          x: 300 + 250 * Math.cos(idx * angleStep),
          y: 300 + 250 * Math.sin(idx * angleStep),
        },
        style: {
          background: getColor(region),
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: 8,
          padding: 8,
          fontWeight: 600,
        },
        type: 'author',
      };
    });
    const edges: Edge[] = Array.from(edgeMap.values()).map(({ source, target, count }) => ({
      id: `${source}-${target}`,
      source,
      target,
      label: count > 1 ? `${count} papers` : undefined,
      animated: count > 2,
      style: { strokeWidth: Math.min(1 + count, 6) },
      labelStyle: { fill: '#333', fontWeight: 600 },
      type: 'default',
    }));
    return { nodes, edges };
  }, [papers]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

  // Update nodes and edges when data changes
  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes, setRfNodes]);
  useEffect(() => {
    setRfEdges(edges);
  }, [edges, setRfEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (onAuthorClick) onAuthorClick(node.id as string);
  }, [onAuthorClick]);

  return (
    <div style={{ width: '100%', height: 600, background: '#f8fafc', borderRadius: 12 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.2}
        maxZoom={2}
        nodeTypes={nodeTypes}
      >
        <MiniMap nodeColor={(n: Node) => getColor((n.data as AuthorNodeData)?.region || 'Global')} />
        <Controls />
        <Background gap={18} size={1} color="#e5e7eb" />
      </ReactFlow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '24px auto 0', alignItems: 'center', justifyContent: 'center', maxWidth: 700 }}>
        {Array.from(new Set(nodes.map(n => (n.data as AuthorNodeData).region))).map(region => (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: getColor(region), width: 18, height: 18, display: 'inline-block', borderRadius: 4, border: '1px solid #ccc' }}></span>
            <span style={{ fontSize: 14, color: '#333' }}>{region}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoAuthorNetworkGraph; 