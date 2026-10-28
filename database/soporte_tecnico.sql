--
-- PostgreSQL database dump
--

\restrict RpQDqtIuQQaO5oaeR9kfZNY0KIWSZ1RvFdjm1syBU9uOlHfUEwmkmUkIxPoH2Rb

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: auditar_cambio_estado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auditar_cambio_estado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.auditoria_tickets a
                  WHERE a.ticket_id = NEW.id AND a.estado_nuevo IS NOT DISTINCT FROM NEW.estado
                    AND a.creado_en = now()) THEN
    INSERT INTO public.auditoria_tickets (ticket_id, actor, accion, estado_anterior, estado_nuevo, detalle)
    VALUES (NEW.id, 'sistema', 'cambio_estado', OLD.estado, NEW.estado,
            jsonb_build_object('origen', 'cambio sin registro explícito (flujo o edición directa en la base)'));
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.auditar_cambio_estado() OWNER TO postgres;

--
-- Name: fijar_actualizado_en(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fijar_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fijar_actualizado_en() OWNER TO postgres;

--
-- Name: fn_auditar_estado_ticket(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_auditar_estado_ticket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.auditoria_tickets(ticket_id, actor, accion, estado_anterior, estado_nuevo, detalle)
    VALUES (NEW.id, 'postgres-trigger', 'cambio_estado', OLD.estado, NEW.estado,
            jsonb_build_object('canal_origen', NEW.canal_origen));
  END IF;
  NEW.actualizado_en := now();
  RETURN NEW;
END; $$;


ALTER FUNCTION public.fn_auditar_estado_ticket() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria_accesos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_accesos (
    id bigint NOT NULL,
    usuario_id bigint,
    correo character varying(254),
    evento character varying(30) NOT NULL,
    ip character varying(64),
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auditoria_accesos OWNER TO postgres;

--
-- Name: auditoria_accesos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_accesos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_accesos_id_seq OWNER TO postgres;

--
-- Name: auditoria_accesos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_accesos_id_seq OWNED BY public.auditoria_accesos.id;


--
-- Name: auditoria_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_tickets (
    id bigint NOT NULL,
    ticket_id integer,
    actor character varying(150) DEFAULT 'n8n'::character varying NOT NULL,
    accion character varying(100) NOT NULL,
    estado_anterior character varying(30),
    estado_nuevo character varying(30),
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auditoria_tickets OWNER TO postgres;

--
-- Name: auditoria_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auditoria_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auditoria_tickets_id_seq OWNER TO postgres;

--
-- Name: auditoria_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auditoria_tickets_id_seq OWNED BY public.auditoria_tickets.id;


--
-- Name: ausencias_tecnicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ausencias_tecnicos (
    id bigint NOT NULL,
    tecnico_id bigint NOT NULL,
    desde date NOT NULL,
    hasta date NOT NULL,
    motivo character varying(200) DEFAULT ''::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ausencias_tecnicos_check CHECK ((hasta >= desde))
);


ALTER TABLE public.ausencias_tecnicos OWNER TO postgres;

--
-- Name: ausencias_tecnicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ausencias_tecnicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ausencias_tecnicos_id_seq OWNER TO postgres;

--
-- Name: ausencias_tecnicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ausencias_tecnicos_id_seq OWNED BY public.ausencias_tecnicos.id;


--
-- Name: base_conocimiento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.base_conocimiento (
    id bigint NOT NULL,
    titulo character varying(250) NOT NULL,
    categoria character varying(80),
    contenido text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.base_conocimiento OWNER TO postgres;

--
-- Name: base_conocimiento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.base_conocimiento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.base_conocimiento_id_seq OWNER TO postgres;

--
-- Name: base_conocimiento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.base_conocimiento_id_seq OWNED BY public.base_conocimiento.id;


--
-- Name: citas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.citas (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    tecnico_id bigint NOT NULL,
    fecha_inicio timestamp with time zone NOT NULL,
    duracion_min integer DEFAULT 60 NOT NULL,
    cuadrante character varying(12) NOT NULL,
    estado character varying(20) DEFAULT 'Agendada'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    hora_llegada timestamp with time zone,
    hora_salida timestamp with time zone,
    CONSTRAINT citas_cuadrante_check CHECK (((cuadrante)::text = ANY ((ARRAY['Norte'::character varying, 'Sur'::character varying, 'Oriente'::character varying, 'Occidente'::character varying])::text[]))),
    CONSTRAINT citas_duracion_min_check CHECK (((duracion_min >= 15) AND (duracion_min <= 240)))
);


ALTER TABLE public.citas OWNER TO postgres;

--
-- Name: citas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.citas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.citas_id_seq OWNER TO postgres;

--
-- Name: citas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.citas_id_seq OWNED BY public.citas.id;


--
-- Name: encuestas_satisfaccion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encuestas_satisfaccion (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    usuario_id bigint,
    tipo character varying(10) NOT NULL,
    resuelto boolean NOT NULL,
    calificacion smallint,
    comentario text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT encuestas_satisfaccion_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5))),
    CONSTRAINT encuestas_satisfaccion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ia'::character varying, 'tecnico'::character varying])::text[])))
);


ALTER TABLE public.encuestas_satisfaccion OWNER TO postgres;

--
-- Name: encuestas_satisfaccion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.encuestas_satisfaccion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encuestas_satisfaccion_id_seq OWNER TO postgres;

--
-- Name: encuestas_satisfaccion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.encuestas_satisfaccion_id_seq OWNED BY public.encuestas_satisfaccion.id;


--
-- Name: historial_chat; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historial_chat (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    emisor character varying(20) NOT NULL,
    mensaje text NOT NULL,
    intento_actual integer,
    fecha_mensaje timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.historial_chat OWNER TO postgres;

--
-- Name: historial_chat_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.historial_chat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.historial_chat_id_seq OWNER TO postgres;

--
-- Name: historial_chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.historial_chat_id_seq OWNED BY public.historial_chat.id;


--
-- Name: resultados_visita; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resultados_visita (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    cita_id bigint,
    tecnico_id bigint NOT NULL,
    diagnostico text NOT NULL,
    trabajo_realizado text NOT NULL,
    repuestos text,
    resultado character varying(30) NOT NULL,
    observaciones text,
    hora_llegada timestamp with time zone,
    hora_salida timestamp with time zone DEFAULT now() NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resultados_visita_resultado_check CHECK (((resultado)::text = ANY ((ARRAY['Resuelto'::character varying, 'Requiere nueva visita'::character varying, 'No resuelto'::character varying])::text[])))
);


ALTER TABLE public.resultados_visita OWNER TO postgres;

--
-- Name: resultados_visita_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resultados_visita_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resultados_visita_id_seq OWNER TO postgres;

--
-- Name: resultados_visita_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resultados_visita_id_seq OWNED BY public.resultados_visita.id;


--
-- Name: sesiones_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sesiones_usuario (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    token_hash character(64) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocado_en timestamp with time zone
);


ALTER TABLE public.sesiones_usuario OWNER TO postgres;

--
-- Name: sesiones_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sesiones_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sesiones_usuario_id_seq OWNER TO postgres;

--
-- Name: sesiones_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sesiones_usuario_id_seq OWNED BY public.sesiones_usuario.id;


--
-- Name: tecnicos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tecnicos (
    id bigint NOT NULL,
    usuario_id bigint,
    nombre character varying(150) NOT NULL,
    correo character varying(254) NOT NULL,
    telefono character varying(30),
    cuadrante character varying(12) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    hora_inicio smallint DEFAULT 8 NOT NULL,
    hora_fin smallint DEFAULT 17 NOT NULL,
    dias_laborales smallint[] DEFAULT '{1,2,3,4,5,6}'::smallint[] NOT NULL,
    CONSTRAINT tecnicos_cuadrante_check CHECK (((cuadrante)::text = ANY ((ARRAY['Norte'::character varying, 'Sur'::character varying, 'Oriente'::character varying, 'Occidente'::character varying])::text[]))),
    CONSTRAINT tecnicos_horario_check CHECK ((((hora_inicio >= 0) AND (hora_inicio <= 23)) AND ((hora_fin >= 1) AND (hora_fin <= 24)) AND (hora_fin > hora_inicio) AND (dias_laborales <@ '{1,2,3,4,5,6,7}'::smallint[]) AND (cardinality(dias_laborales) > 0)))
);


ALTER TABLE public.tecnicos OWNER TO postgres;

--
-- Name: tecnicos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tecnicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tecnicos_id_seq OWNER TO postgres;

--
-- Name: tecnicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tecnicos_id_seq OWNED BY public.tecnicos.id;


--
-- Name: tickets_soporte; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets_soporte (
    id integer NOT NULL,
    nombre_completo character varying(150) NOT NULL,
    identificacion character varying(50) NOT NULL,
    correo character varying(150),
    telefono character varying(30),
    tipo_dispositivo character varying(100),
    descripcion_problema text NOT NULL,
    estado character varying(30) DEFAULT 'Pendiente'::character varying,
    fecha_creacion timestamp with time zone DEFAULT now(),
    direccion text,
    canal_origen character varying(20) DEFAULT 'web'::character varying NOT NULL,
    categoria character varying(30),
    nivel_impacto character varying(10),
    es_dano_fisico boolean,
    intentos_ia smallint DEFAULT 0 NOT NULL,
    tecnico_asignado_id bigint,
    fecha_visita timestamp with time zone,
    fecha_cierre timestamp with time zone,
    url_acta text,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id bigint,
    prioridad character varying(10),
    puntaje_prioridad smallint,
    motivo_prioridad character varying(120),
    fecha_limite_atencion timestamp with time zone,
    sla_notificado boolean DEFAULT false NOT NULL,
    acta_sha256 character(64),
    CONSTRAINT tickets_soporte_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['Crítica'::character varying, 'Alta'::character varying, 'Media'::character varying, 'Baja'::character varying])::text[])))
);


ALTER TABLE public.tickets_soporte OWNER TO postgres;

--
-- Name: tickets_soporte_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_soporte_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_soporte_id_seq OWNER TO postgres;

--
-- Name: tickets_soporte_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_soporte_id_seq OWNED BY public.tickets_soporte.id;


--
-- Name: tokens_recuperacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tokens_recuperacion (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    token_hash character(64) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone
);


ALTER TABLE public.tokens_recuperacion OWNER TO postgres;

--
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tokens_recuperacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tokens_recuperacion_id_seq OWNER TO postgres;

--
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tokens_recuperacion_id_seq OWNED BY public.tokens_recuperacion.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id bigint NOT NULL,
    nombre_completo character varying(150) NOT NULL,
    correo character varying(254) NOT NULL,
    identificacion character varying(50),
    telefono character varying(30),
    direccion text,
    rol character varying(20) DEFAULT 'cliente'::character varying NOT NULL,
    password_hash text,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    cuadrante character varying(50),
    estado character varying(50) DEFAULT 'disponible'::character varying,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: zonas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zonas (
    id integer NOT NULL,
    nombre character varying(12) NOT NULL,
    palabras_clave text DEFAULT ''::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.zonas OWNER TO postgres;

--
-- Name: zonas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zonas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zonas_id_seq OWNER TO postgres;

--
-- Name: zonas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zonas_id_seq OWNED BY public.zonas.id;


--
-- Name: auditoria_accesos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_accesos ALTER COLUMN id SET DEFAULT nextval('public.auditoria_accesos_id_seq'::regclass);


--
-- Name: auditoria_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_tickets ALTER COLUMN id SET DEFAULT nextval('public.auditoria_tickets_id_seq'::regclass);


--
-- Name: ausencias_tecnicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ausencias_tecnicos ALTER COLUMN id SET DEFAULT nextval('public.ausencias_tecnicos_id_seq'::regclass);


--
-- Name: base_conocimiento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.base_conocimiento ALTER COLUMN id SET DEFAULT nextval('public.base_conocimiento_id_seq'::regclass);


--
-- Name: citas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.citas ALTER COLUMN id SET DEFAULT nextval('public.citas_id_seq'::regclass);


--
-- Name: encuestas_satisfaccion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encuestas_satisfaccion ALTER COLUMN id SET DEFAULT nextval('public.encuestas_satisfaccion_id_seq'::regclass);


--
-- Name: historial_chat id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_chat ALTER COLUMN id SET DEFAULT nextval('public.historial_chat_id_seq'::regclass);


--
-- Name: resultados_visita id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados_visita ALTER COLUMN id SET DEFAULT nextval('public.resultados_visita_id_seq'::regclass);


--
-- Name: sesiones_usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_usuario ALTER COLUMN id SET DEFAULT nextval('public.sesiones_usuario_id_seq'::regclass);


--
-- Name: tecnicos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos ALTER COLUMN id SET DEFAULT nextval('public.tecnicos_id_seq'::regclass);


--
-- Name: tickets_soporte id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte ALTER COLUMN id SET DEFAULT nextval('public.tickets_soporte_id_seq'::regclass);


--
-- Name: tokens_recuperacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_recuperacion ALTER COLUMN id SET DEFAULT nextval('public.tokens_recuperacion_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: zonas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zonas ALTER COLUMN id SET DEFAULT nextval('public.zonas_id_seq'::regclass);


--
-- Data for Name: auditoria_accesos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_accesos (id, usuario_id, correo, evento, ip, creado_en) FROM stdin;
1	8	sasannmil2016@gmail.com	login_ok	::1	2026-10-24 21:33:20.011022-05
2	8	sasannmil2016@gmail.com	logout	::1	2026-10-24 21:34:22.536246-05
3	18	andres.tecnico@empresa.com	login_ok	::1	2026-10-24 21:35:17.125903-05
4	18	andres.tecnico@empresa.com	logout	::1	2026-10-24 21:37:06.576885-05
5	8	sasannmil2016@gmail.com	login_ok	::1	2026-10-24 21:37:20.707182-05
6	8	sasannmil2016@gmail.com	logout	::1	2026-10-24 21:38:08.406353-05
7	24	julianlondoo14@outlook.com	logout	::1	2026-10-24 22:03:16.768057-05
8	23	milenahoyossss@gmail.com	login_ok	::1	2026-10-24 22:03:34.827407-05
9	23	milenahoyossss@gmail.com	logout	::1	2026-10-24 22:04:43.752223-05
10	18	andres.tecnico@empresa.com	login_ok	::1	2026-10-24 22:04:55.894171-05
11	18	andres.tecnico@empresa.com	logout	::1	2026-10-24 22:05:18.811496-05
12	\N	sasannmil2016@gmail.com	login_fallido	::1	2026-10-25 09:43:40.58585-05
13	8	sasannmil2016@gmail.com	login_ok	::1	2026-10-25 09:43:49.418126-05
14	8	sasannmil2016@gmail.com	logout	::1	2026-10-25 09:50:45.846843-05
15	23	milenahoyossss@gmail.com	login_ok	::1	2026-10-25 09:50:59.594184-05
16	23	milenahoyossss@gmail.com	logout	::1	2026-10-25 09:59:44.128724-05
17	13	diana.tecnico@empresa.com	login_ok	::1	2026-10-25 09:59:53.243441-05
18	13	diana.tecnico@empresa.com	logout	::1	2026-10-25 10:00:36.757001-05
19	8	sasannmil2016@gmail.com	login_ok	::1	2026-10-25 10:01:17.901688-05
\.


--
-- Data for Name: auditoria_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_tickets (id, ticket_id, actor, accion, estado_anterior, estado_nuevo, detalle, creado_en) FROM stdin;
1	5	postgres-trigger	cambio_estado	Pendiente	En diagnóstico	{"canal_origen": "web"}	2026-10-23 17:40:02.242859-05
2	5	postgres-trigger	cambio_estado	En diagnóstico	Escalamiento pendiente	{"canal_origen": "web"}	2026-10-23 17:54:01.400534-05
3	5	postgres-trigger	cambio_estado	Escalamiento pendiente	Pendiente de asignación	{"canal_origen": "web"}	2026-10-23 18:04:07.212196-05
4	5	n8n	sin_cupo	\N	Pendiente de asignación	{"motivo": "Dirección sin cuadrante identificable"}	2026-10-23 18:04:07.212196-05
5	5	postgres-trigger	cambio_estado	Pendiente de asignación	Escalamiento pendiente	{"canal_origen": "web"}	2026-10-23 18:45:40.475382-05
6	27	correo:bryan@neon.tech	ticket_creado	\N	Pendiente	{"canal": "email"}	2026-10-24 16:36:10.922242-05
7	28	cliente:8	ticket_creado	\N	Pendiente	{"canal": "web"}	2026-10-24 17:08:52.685079-05
8	28	postgres-trigger	cambio_estado	Pendiente	En diagnóstico	{"canal_origen": "web"}	2026-10-24 17:08:53.430223-05
9	28	postgres-trigger	cambio_estado	En diagnóstico	Escalamiento pendiente	{"canal_origen": "web"}	2026-10-24 17:10:02.375291-05
10	28	n8n	escalamiento_solicitado	En diagnóstico	Escalamiento pendiente	{"motivo": "limite_intentos"}	2026-10-24 17:10:02.375291-05
11	28	postgres-trigger	cambio_estado	Escalamiento pendiente	Escalado nivel 2	{"canal_origen": "web"}	2026-10-24 17:10:17.408453-05
12	28	n8n	escalamiento_nivel_2	Escalamiento pendiente	Escalado nivel 2	{}	2026-10-24 17:10:17.408453-05
13	29	cliente:24	ticket_creado	\N	Pendiente	{"canal": "web"}	2026-10-24 17:51:54.361773-05
14	29	postgres-trigger	cambio_estado	Pendiente	Escalamiento pendiente	{"canal_origen": "web"}	2026-10-24 17:51:54.996349-05
15	29	n8n	escalamiento_solicitado	Pendiente	Escalamiento pendiente	{"motivo": "riesgo_fisico"}	2026-10-24 17:51:54.996349-05
16	29	postgres-trigger	cambio_estado	Escalamiento pendiente	Agendado	{"canal_origen": "web"}	2026-10-24 17:52:58.904394-05
17	29	n8n	cita_agendada	Escalamiento pendiente	Agendado	{"cita_id": 1, "cuadrante": "Occidente", "tecnico_id": "4", "fecha_visita": "2026-10-26T08:00:00-05:00"}	2026-10-24 17:52:58.904394-05
24	28	postgres-trigger	cambio_estado	Escalado nivel 2	Agendado	{"canal_origen": "web"}	2026-10-24 17:57:42.610509-05
25	28	admin:23	asignacion_manual	Escalado nivel 2	Agendado	{"tecnico_id": 9, "fecha_visita": "2026-10-31T21:57:00-05:00"}	2026-10-24 17:57:42.610509-05
26	29	postgres-trigger	cambio_estado	Agendado	Cerrado	{"canal_origen": "web"}	2026-10-24 19:03:18.908038-05
27	29	tecnico:4	cierre_tecnico	Agendado	Cerrado	{"url_acta": "http://localhost:3000/actas/ticket-29-e138a8635bedd2c1c9402f45.pdf", "resultado": "Se reviso la pila y cambio"}	2026-10-24 19:03:18.908038-05
28	28	postgres-trigger	cambio_estado	Agendado	En atención	{"canal_origen": "web"}	2026-10-24 21:35:26.48913-05
29	28	tecnico:9	inicio_visita	Agendado	En atención	{"hora_llegada": "2026-10-24T21:35:26.48913-05:00"}	2026-10-24 21:35:26.48913-05
30	28	postgres-trigger	cambio_estado	En atención	Pendiente de confirmación	{"canal_origen": "web"}	2026-10-24 21:36:24.028811-05
31	28	tecnico:9	resultado_visita	En atención	Pendiente de confirmación	{"resultado": "Resuelto", "resultado_id": 1}	2026-10-24 21:36:24.028811-05
32	28	tecnico:9	acta_generada	\N	Pendiente de confirmación	{"sha256": "c09b6d008498f6a2ffb3bf36850f0e85ed5dec14fd7ab94a02de89bdda4e904f", "archivo": "ticket-28-e16b6e605f43439576e7cdbe.pdf"}	2026-10-24 21:36:24.35157-05
33	28	postgres-trigger	cambio_estado	Pendiente de confirmación	Cerrado	{"canal_origen": "web"}	2026-10-24 21:38:04.502905-05
34	28	cliente:8	encuesta_confirma_solucion	Pendiente de confirmación	Cerrado	{"tipo": "tecnico", "comentario": null, "calificacion": 4}	2026-10-24 21:38:04.502905-05
35	30	correo:info@notifications.lumosity.com	ticket_creado	\N	Pendiente	{"canal": "email", "prioridad": "Baja", "motivo_prioridad": "Consulta o configuración"}	2026-10-25 09:37:50.572254-05
36	31	cliente:8	ticket_creado	\N	Pendiente	{"canal": "web", "prioridad": "Media", "motivo_prioridad": "Palabra clave: \\"no carga\\""}	2026-10-25 09:45:02.705673-05
37	31	postgres-trigger	cambio_estado	Pendiente	En diagnóstico	{"canal_origen": "web"}	2026-10-25 09:45:03.703208-05
38	31	postgres-trigger	cambio_estado	En diagnóstico	Escalamiento pendiente	{"canal_origen": "web"}	2026-10-25 09:49:48.334181-05
39	31	n8n	escalamiento_solicitado	En diagnóstico	Escalamiento pendiente	{"motivo": "limite_intentos"}	2026-10-25 09:49:48.334181-05
40	31	postgres-trigger	cambio_estado	Escalamiento pendiente	Escalado nivel 2	{"canal_origen": "web"}	2026-10-25 09:50:01.666516-05
41	31	n8n	escalamiento_nivel_2	Escalamiento pendiente	Escalado nivel 2	{}	2026-10-25 09:50:01.666516-05
42	31	postgres-trigger	cambio_estado	Escalado nivel 2	Agendado	{"canal_origen": "web"}	2026-10-25 09:59:26.715041-05
43	31	admin:23	asignacion_manual	Escalado nivel 2	Agendado	{"tecnico_id": 4, "fecha_visita": "2026-10-27T11:00:00-05:00"}	2026-10-25 09:59:26.715041-05
44	31	postgres-trigger	cambio_estado	Agendado	Pendiente de confirmación	{"canal_origen": "web"}	2026-10-25 10:00:31.52886-05
45	31	tecnico:4	resultado_visita	Agendado	Pendiente de confirmación	{"resultado": "Resuelto", "resultado_id": 2}	2026-10-25 10:00:31.52886-05
46	31	tecnico:4	acta_generada	\N	Pendiente de confirmación	{"sha256": "f95a876c94fc565f67e33199259106f66da0ad75feccaf997d7b6edb7f57e345", "archivo": "ticket-31-a94da05cd74910f52b0f9212.pdf"}	2026-10-25 10:00:31.762235-05
47	31	postgres-trigger	cambio_estado	Pendiente de confirmación	Cerrado	{"canal_origen": "web"}	2026-10-25 10:01:43.990864-05
48	31	cliente:8	encuesta_confirma_solucion	Pendiente de confirmación	Cerrado	{"tipo": "tecnico", "comentario": "La mala pa todos", "calificacion": 4}	2026-10-25 10:01:43.990864-05
\.


--
-- Data for Name: ausencias_tecnicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ausencias_tecnicos (id, tecnico_id, desde, hasta, motivo, creado_en) FROM stdin;
\.


--
-- Data for Name: base_conocimiento; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.base_conocimiento (id, titulo, categoria, contenido, activo, creado_en) FROM stdin;
1	El equipo se calienta y se apaga solo	Hardware	1. Usa el equipo sobre una superficie dura y plana, nunca sobre cama o cojines. 2. Revisa que las rejillas de ventilación no estén tapadas. 3. Cierra programas pesados. 4. Si el ventilador hace mucho ruido o el equipo se apaga por calor con frecuencia, requiere limpieza interna por un técnico.	t	2026-10-24 21:24:53.503202-05
2	Un programa no abre o se cierra solo	Software	1. Reinicia el equipo. 2. Ejecuta el programa como administrador (clic derecho > Ejecutar como administrador). 3. Actualiza el programa a la última versión. 4. Si sigue fallando, desinstálalo y vuelve a instalarlo desde el sitio oficial.	t	2026-10-24 21:24:53.503202-05
3	La cámara no funciona en videollamadas	Software	1. Revisa que la cámara no tenga una tapa física o un interruptor apagado. 2. En Configuración > Privacidad > Cámara, permite el acceso a las aplicaciones. 3. Cierra otras aplicaciones que puedan estar usando la cámara. 4. En la aplicación de videollamada, elige la cámara correcta en la configuración.	t	2026-10-24 21:24:53.503202-05
4	No se escucha el sonido	Software	1. Revisa que el volumen no esté en silencio, tanto en Windows como en la aplicación. 2. Haz clic en el icono de sonido y elige el dispositivo de salida correcto (parlantes o audífonos). 3. Desconecta y vuelve a conectar los audífonos. 4. Ejecuta el solucionador de problemas de audio de Windows.	t	2026-10-24 21:24:53.503202-05
5	Atasco de papel en la impresora	Periféricos	1. Apaga la impresora y desconéctala. 2. Abre las tapas indicadas en el manual y retira el papel con cuidado, tirando en la dirección en que avanza. 3. Revisa que no queden pedazos. 4. Usa papel seco y sin arrugas, sin sobrecargar la bandeja. No uses objetos metálicos para retirar el papel.	t	2026-10-24 21:24:53.503202-05
6	El portátil no carga la batería	Hardware	1. Revisa que el cargador sea el original y que el indicador de carga se encienda. 2. Prueba en otra toma eléctrica. 3. Revisa que el conector no esté flojo ni dañado. 4. Apaga el equipo, desconéctalo 1 minuto y vuelve a conectarlo. 5. Si la batería se ve hinchada o el equipo se calienta mucho, desconéctalo y no lo uses: requiere técnico.	t	2026-10-24 21:24:53.503202-05
7	Pantallazo azul (error de Windows)	Software	1. Anota el código que aparece en la pantalla azul (por ejemplo, CRITICAL_PROCESS_DIED). 2. Reinicia y desconecta los dispositivos USB nuevos. 3. Si comenzó tras instalar un programa o controlador, desinstálalo. 4. Ejecuta Windows Update. 5. Si se repite varias veces, el caso requiere revisión técnica; informa el código.	t	2026-10-24 21:24:53.503202-05
8	Internet lento	Red	1. Haz una prueba de velocidad y compárala con el plan contratado. 2. Cierra descargas, actualizaciones o videos en otros dispositivos. 3. Reinicia el router. 4. Si es posible, conecta el equipo por cable para comparar. 5. Si la velocidad sigue baja en todos los equipos, comunícate con tu proveedor de internet.	t	2026-10-24 21:24:53.503202-05
9	El computador no enciende	Hardware	1. Verifica que el cargador o el cable de poder esté bien conectado a la toma y al equipo, y que la toma funcione (prueba con otro aparato). 2. En portátiles, si la batería es removible, retírala, desconecta el cargador, mantén presionado el botón de encendido 30 segundos, vuelve a conectar solo el cargador e intenta encender. 3. Observa si se encienden luces o ventiladores. Si no hay ninguna señal, el caso requiere revisión de un técnico.	t	2026-10-24 21:24:53.503202-05
10	Correo sospechoso o posible estafa (phishing)	Seguridad	No abras archivos adjuntos ni enlaces de correos inesperados. Revisa la dirección real del remitente. Ninguna entidad seria pide contraseñas o códigos por correo. Si ya ingresaste tu clave en un enlace sospechoso, cámbiala de inmediato y activa la verificación en dos pasos.	t	2026-10-24 21:24:53.503202-05
11	El mouse o touchpad no responde	Periféricos	1. Si es inalámbrico, cambia las pilas y vuelve a conectar el receptor USB. 2. Prueba otro puerto USB. 3. En portátiles, revisa la tecla de función que activa o desactiva el touchpad. 4. Reinicia el equipo.	t	2026-10-24 21:24:53.503202-05
12	Windows Update se queda detenido	Software	1. Espera al menos una hora: algunas actualizaciones tardan. 2. Reinicia el equipo y vuelve a buscar actualizaciones. 3. Ejecuta el solucionador de problemas de Windows Update. 4. Verifica que haya espacio libre suficiente en el disco.	t	2026-10-24 21:24:53.503202-05
13	La impresora no imprime	Periféricos	1. Verifica que la impresora esté encendida, con papel y sin luces de error. 2. Revisa que esté conectada (cable USB o la misma red wifi del equipo). 3. En Configuración > Impresoras, elige la impresora correcta como predeterminada. 4. Abre la cola de impresión, cancela los documentos atascados y vuelve a imprimir. 5. Reinicia la impresora y el equipo.	t	2026-10-24 21:24:53.503202-05
14	El wifi se desconecta a cada rato	Red	1. Acércate al router para descartar mala señal. 2. Reinicia el router. 3. En el Administrador de dispositivos, en el adaptador de red inalámbrica, desmarca la opción de apagar el dispositivo para ahorrar energía. 4. Actualiza el controlador del adaptador wifi. 5. Si solo falla un equipo y los demás no, el adaptador puede requerir revisión.	t	2026-10-24 21:24:53.503202-05
15	No hay espacio en el disco	Software	1. Abre Configuración > Sistema > Almacenamiento y usa el Sensor de almacenamiento para borrar archivos temporales. 2. Vacía la papelera de reciclaje. 3. Desinstala programas que no uses. 4. Mueve fotos y videos a un disco externo o a la nube.	t	2026-10-24 21:24:53.503202-05
16	El equipo está muy lento	Software	1. Reinicia el equipo (no solo suspender). 2. Abre el Administrador de tareas (Ctrl + Shift + Esc) y revisa qué programa usa más CPU, memoria o disco; ciérralo si no lo necesitas. 3. Desactiva programas de inicio innecesarios en la pestaña Inicio. 4. Verifica que haya al menos 15% de espacio libre en el disco. 5. Ejecuta Windows Update y un análisis del antivirus.	t	2026-10-24 21:24:53.503202-05
17	Posible virus o ventanas emergentes	Seguridad	1. Desconecta el equipo de internet si notas comportamiento extraño. 2. Ejecuta un análisis completo con el antivirus (Seguridad de Windows > Protección contra virus). 3. Desinstala programas que no reconozcas. 4. Revisa extensiones del navegador y elimina las desconocidas. 5. Cambia tus contraseñas desde otro dispositivo seguro. Si aparecen mensajes pidiendo pago para recuperar archivos, no pagues y solicita un técnico.	t	2026-10-24 21:24:53.503202-05
18	Se derramó líquido sobre el equipo	Hardware	Apaga el equipo de inmediato y desconéctalo de la corriente. Si es portátil y la batería es removible, retírala. Voltea el equipo para que escurra el líquido. No lo enciendas ni uses secador de pelo. Este caso requiere revisión técnica lo antes posible.	t	2026-10-24 21:24:53.503202-05
19	El teclado no funciona o escribe mal	Periféricos	1. Reinicia el equipo. 2. Si es un teclado USB o inalámbrico, cámbialo de puerto o revisa las pilas. 3. Revisa que no esté activado el bloqueo numérico o un idioma de teclado distinto (Windows + Espacio para cambiar). 4. Prueba con el teclado en pantalla para descartar falla del sistema.	t	2026-10-24 21:24:53.503202-05
20	No hay internet por wifi	Red	1. Verifica que el wifi esté activado (icono de red o tecla de modo avión desactivada). 2. Revisa si otros dispositivos tienen internet: si ninguno navega, reinicia el router desconectándolo 30 segundos. 3. En el equipo, olvida la red wifi y vuelve a conectarte escribiendo la clave. 4. Ejecuta el solucionador de problemas de red de Windows.	t	2026-10-24 21:24:53.503202-05
21	Pantalla negra pero el equipo enciende	Hardware	1. Sube el brillo con las teclas de función (Fn + tecla de sol). 2. Presiona Windows + Ctrl + Shift + B para reiniciar el controlador de video. 3. Conecta un monitor externo: si ahí se ve, la falla es de la pantalla. 4. Si nada se ve en ninguna pantalla, se requiere revisión técnica.	t	2026-10-24 21:24:53.503202-05
22	El monitor externo no da imagen	Periféricos	1. Revisa que el monitor esté encendido y que el cable (HDMI, DisplayPort) esté bien conectado en ambos extremos. 2. En el monitor, elige la entrada correcta con el botón Source/Input. 3. En el equipo presiona Windows + P y elige Duplicar o Extender. 4. Prueba con otro cable.	t	2026-10-24 21:24:53.503202-05
23	Olvidé la contraseña de Windows	Cuentas	Si usas una cuenta Microsoft, restablece la contraseña desde account.live.com/password/reset en otro dispositivo y luego inicia sesión con la nueva. Si es una cuenta local, usa las preguntas de seguridad que aparecen después de un intento fallido. Nunca compartas tu contraseña con nadie, tampoco con el soporte.	t	2026-10-24 21:24:53.503202-05
24	Recomendaciones de seguridad eléctrica	Seguridad	Si sientes olor a quemado, ves humo o chispas, o la batería está hinchada: desconecta el equipo de la corriente sin tocar partes calientes, aléjalo de materiales inflamables y no lo vuelvas a encender. Solicita un técnico. No abras el equipo ni intentes reparar la fuente o el cargador.	t	2026-10-24 21:24:53.503202-05
25	El celular no se conecta al computador por USB	Periféricos	1. Usa un cable que transfiera datos (algunos solo cargan). 2. Desbloquea el celular y, en la notificación USB, elige Transferencia de archivos. 3. Prueba otro puerto USB. 4. Reinicia ambos dispositivos.	t	2026-10-24 21:24:53.503202-05
\.


--
-- Data for Name: citas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.citas (id, ticket_id, tecnico_id, fecha_inicio, duracion_min, cuadrante, estado, creado_en, hora_llegada, hora_salida) FROM stdin;
1	29	4	2026-10-26 08:00:00-05	60	Occidente	Realizada	2026-10-24 17:52:58.904394-05	\N	\N
2	28	9	2026-10-31 21:57:00-05	60	Norte	Realizada	2026-10-24 17:57:42.610509-05	2026-10-24 21:35:26.48913-05	2026-10-24 21:36:24.028811-05
3	31	4	2026-10-27 11:00:00-05	60	Occidente	Realizada	2026-10-25 09:59:26.715041-05	2026-10-25 10:00:31.52886-05	2026-10-25 10:00:31.52886-05
\.


--
-- Data for Name: encuestas_satisfaccion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.encuestas_satisfaccion (id, ticket_id, usuario_id, tipo, resuelto, calificacion, comentario, creado_en) FROM stdin;
1	28	8	tecnico	t	4	\N	2026-10-24 21:38:04.502905-05
2	31	8	tecnico	t	4	La mala pa todos	2026-10-25 10:01:43.990864-05
\.


--
-- Data for Name: historial_chat; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.historial_chat (id, ticket_id, emisor, mensaje, intento_actual, fecha_mensaje, metadata) FROM stdin;
2	3	usuario	El paso anterior no funcionó, dame otra alternativa.	2	2026-10-14 09:13:56.570432-05	{}
3	3	usuario	El paso anterior no funcionó, dame otra alternativa.	3	2026-10-14 09:14:38.206573-05	{}
4	6	usuario	El paso anterior no funcionó, dame otra alternativa.	2	2026-10-14 19:37:00.025308-05	{}
5	6	usuario	El paso anterior no funcionó, dame otra alternativa.	3	2026-10-14 19:37:10.744374-05	{}
6	7	usuario	El paso anterior no funcionó, dame otra alternativa.	2	2026-10-14 21:23:44.826477-05	{}
7	7	usuario	El paso anterior no funcionó, dame otra alternativa.	3	2026-10-14 21:23:55.759754-05	{}
8	5	usuario	No prende el computador	1	2026-10-23 17:40:02.242859-05	{"canal": "web"}
9	5	usuario	Hola	2	2026-10-23 17:40:35.354698-05	{"canal": "web"}
10	5	IA	Hola. Entiendo que su portátil no enciende. Al no contar con un registro específico en nuestra base de conocimientos para este caso, realizaremos un procedimiento general de descarga de energía estática.\n\n**Nota de seguridad:** Si observa humo, presencia de líquidos, batería hinchada, chispas u olor a quemado, por favor no realice este paso y avíseme de inmediato para escalar su caso con un técnico.\n\nSi el equipo se encuentra en buen estado físico, siga este procedimiento:\n1. Desconecte el cargador del portátil.\n2. Mantenga presionado el botón de encendido durante 30 segundos continuos.\n3. Conecte nuevamente el cargador e intente encender el equipo de forma habitual.\n\nMarque Sí si se resolvió o No si necesita otra alternativa.	2	2026-10-23 17:40:41.026411-05	{"modelo": "Gemini", "fuente_conocimiento": true}
11	5	usuario	No prende mi computador	3	2026-10-23 17:45:41.164947-05	{"canal": "web"}
12	5	IA	Hola. Lamento que su portátil continúe sin encender. Al no contar con un registro específico para este caso en nuestra base de conocimientos, realizaremos una comprobación básica de la fuente de alimentación.\n\n**Nota de seguridad:** Si observa humo, presencia de líquidos, batería hinchada, chispas u olor a quemado, por favor **detenga cualquier acción** y avíseme de inmediato para escalar su caso con un técnico.\n\nSi el equipo se encuentra en buen estado físico, realice este procedimiento:\n1. Conecte el cargador al portátil y a un enchufe de pared que funcione correctamente.\n2. Verifique si se ilumina alguna pequeña luz (LED) en los costados del portátil o en el cuerpo del cargador.\n3. Si no hay luz, pruebe conectando el cargador en un tomacorriente distinto.\n\nMarque **Sí** si se resolvió o **No** si necesita otra alternativa.	3	2026-10-23 17:45:46.381311-05	{"modelo": "Gemini", "fuente_conocimiento": true}
13	5	usuario	No prende el compputador	3	2026-10-23 17:50:11.381456-05	{"canal": "web", "motivo": "escalamiento"}
14	5	usuario	El paso anterior no funcionó, indícame qué más puedo hacer.	3	2026-10-23 17:59:51.870379-05	{"canal": "web", "motivo": "escalamiento"}
15	5	usuario	No prende	3	2026-10-23 18:45:40.453897-05	{"canal": "web", "motivo": "escalamiento"}
16	5	usuario	No prende	3	2026-10-23 18:48:54.022271-05	{"canal": "web", "motivo": "escalamiento"}
17	28	usuario	No me prende el computador	1	2026-10-24 17:08:53.430223-05	{"canal": "web"}
18	28	IA	Para intentar encender tu computador, por favor sigue este procedimiento de verificación básica:\n\n1. Asegúrate de que el cable de alimentación esté firmemente conectado tanto al computador como al enchufe de la pared.\n2. Si usas una regleta o multitoma, verifica que esté encendida o conecta el equipo directamente a un enchufe de pared que sepas que funciona (puedes probarlo antes con una lámpara o cargador de celular).\n3. Desconecta cualquier accesorio innecesario (memorias USB, impresoras o discos externos).\n4. Mantén presionado el botón de encendido durante 15 segundos exactos para liberar energía estática.\n5. Suelta el botón y vuelve a presionarlo una sola vez de forma normal para intentar encenderlo.\n\nPor favor, indica si esto funcionó pulsando: "Sí, se solucionó" o "No funcionó".	1	2026-10-24 17:08:57.234717-05	{"error": false, "modelo": "gemini", "uso_conocimiento": false}
19	28	usuario	El boton de encendido se le cayo	2	2026-10-24 17:09:19.781389-05	{"canal": "web"}
20	28	IA	Lamento el inconveniente con el hardware de tu equipo. Debido a que el botón físico se ha desprendido, realizaremos una comprobación de encendido alternativo de forma segura:\n\n1. Inspecciona los laterales y la parte inferior del computador en busca de un botón secundario o un orificio diminuto (comúnmente identificado con un icono de flecha curva).\n2. Si localizas este orificio, introduce suavemente la punta de un clip para papel hasta sentir un pequeño clic para intentar el encendido.\n3. En caso de no encontrar un botón de emergencia, evita introducir objetos metálicos en el hueco dejado por el botón original, ya que esto podría causar un cortocircuito.\n\nSi estos pasos no funcionan, el dispositivo requerirá asistencia técnica física para reemplazar la pieza dañada.\n\nPor favor, indica si esto funcionó pulsando: "Sí, se solucionó" o "No funcionó".	2	2026-10-24 17:09:31.910139-05	{"error": false, "modelo": "gemini", "uso_conocimiento": false}
21	28	usuario	no hay mas botones, era el unico	3	2026-10-24 17:09:51.742284-05	{"canal": "web"}
22	28	IA	Lamento que no encuentres botones adicionales. Al faltar la pieza física del botón de encendido y no disponer de un botón de emergencia, realiza esta última comprobación de estado:\n\n1. Conecta el cable de alimentación y observa detenidamente los bordes o el frente del equipo en busca de alguna pequeña luz (LED) indicadora.\n2. Si ves una luz encendida, presiona varias teclas (como la barra espaciadora) o mueve el ratón para descartar que el equipo esté encendido pero con la pantalla en reposo.\n3. Si no hay luces ni respuesta, el daño es de hardware y el equipo debe ser llevado a un servicio técnico para reemplazar el interruptor interno, ya que no es seguro intentar encenderlo manipulando el hueco del botón.\n\nPor favor, indica si esto funcionó pulsando: "Sí, se solucionó" o "No funcionó".	3	2026-10-24 17:09:58.391228-05	{"error": false, "modelo": "gemini", "uso_conocimiento": false}
23	28	sistema	Agotamos los 3 intentos con el asistente. Completa los datos para asignarte un técnico.	3	2026-10-24 17:10:02.375291-05	{"motivo": "limite_intentos"}
24	29	sistema	⚠️ Por tu seguridad, desconecta el equipo de la corriente y no lo sigas usando. Este caso necesita revisión de un técnico: completa los datos de la visita.	0	2026-10-24 17:51:54.996349-05	{"motivo": "riesgo_fisico"}
25	29	usuario	Al celular le esta saliendo humo	0	2026-10-24 17:51:54.996349-05	{"canal": "web"}
26	31	usuario	Mi celular no carga, no le sirve ningun cargador	1	2026-10-25 09:45:03.703208-05	{"canal": "web"}
27	31	IA	Lamento que tu celular no cargue. Por favor, realiza el siguiente procedimiento:\n\n1. Limpia con cuidado el puerto de carga del celular usando un palillo de madera seco para retirar posibles restos de pelusa o suciedad que impidan el contacto.\n2. Conecta el cable original firmemente al dispositivo y a un tomacorriente distinto al que usas habitualmente (verifica que el tomacorriente funcione con otro aparato).\n3. Con el celular conectado, mantén presionados simultáneamente los botones de **Encendido** y **Bajar Volumen** durante 15 segundos para forzar un reinicio del sistema.\n4. Deja el equipo conectado por 20 minutos para verificar si aparece el icono de carga en la pantalla.\n\nPor favor, pulse "Sí, se solucionó" o "No funcionó".	1	2026-10-25 09:45:12.940229-05	{"error": false, "modelo": "gemini", "uso_conocimiento": true}
28	31	usuario	Creo que le dano el puerto de carga porque sale como torcido	2	2026-10-25 09:48:46.442281-05	{"canal": "web"}
29	31	IA	Lamento que el puerto de carga presente daños físicos. Realiza el siguiente procedimiento de verificación:\n\n1. Apaga el equipo e inspecciona el puerto con una linterna para confirmar si los pines internos están doblados o fuera de su posición original.\n2. Conecta el cable original muy suavemente; si notas resistencia o si el conector queda demasiado flojo y no inicia la carga, retíralo inmediatamente.\n3. No intentes enderezar el puerto ni forzar la entrada del cargador con ningún objeto, ya que esto podría causar un cortocircuito.\n\nSi el puerto está visiblemente deformado y no permite una conexión firme, el dispositivo requiere ser revisado por un técnico especializado para reemplazar la pieza de hardware dañada.\n\nPor favor, pulse "Sí, se solucionó" o "No funcionó".	2	2026-10-25 09:48:57.788992-05	{"error": false, "modelo": "gemini", "uso_conocimiento": true}
30	31	usuario	Creo que se le cayo un pedazo	3	2026-10-25 09:49:35.708652-05	{"canal": "web"}
31	31	IA	Lamento que se haya desprendido una pieza del puerto de carga. Al existir una rotura física, sigue este procedimiento de seguridad:\n\n1. Apaga el celular inmediatamente para evitar que los contactos internos dañados o piezas sueltas provoquen un cortocircuito.\n2. Inspecciona visualmente el puerto con una linterna para confirmar si faltan los pines metálicos o la lengüeta central, pero **no** intentes introducir ningún objeto ni pegar la pieza desprendida.\n3. No conectes el cargador bajo ninguna circunstancia, ya que el flujo eléctrico sobre un puerto roto puede sobrecalentar el equipo.\n\nDebido a que el daño es físico (hardware), el dispositivo requiere obligatoriamente el reemplazo de la pieza por un técnico especializado.\n\nPor favor, pulse "Sí, se solucionó" o "No funcionó".	3	2026-10-25 09:49:42.695146-05	{"error": false, "modelo": "gemini", "uso_conocimiento": true}
32	31	sistema	Agotamos los 3 intentos con el asistente. Completa los datos para asignarte un técnico.	3	2026-10-25 09:49:48.334181-05	{"motivo": "limite_intentos"}
\.


--
-- Data for Name: resultados_visita; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resultados_visita (id, ticket_id, cita_id, tecnico_id, diagnostico, trabajo_realizado, repuestos, resultado, observaciones, hora_llegada, hora_salida, creado_en) FROM stdin;
1	28	2	9	El teclado estaba mojado por lo que no encendia el computador	Se limppio toda la plaza y reviso el estado de los compnentes	\N	Resuelto	\N	2026-10-24 21:35:26.48913-05	2026-10-24 21:36:24.028811-05	2026-10-24 21:36:24.028811-05
2	31	3	4	Estaba sucio el puerto	Limpieza de puerto	\N	Resuelto	Ninguna	2026-10-25 10:00:31.52886-05	2026-10-25 10:00:31.52886-05	2026-10-25 10:00:31.52886-05
\.


--
-- Data for Name: sesiones_usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sesiones_usuario (id, usuario_id, token_hash, creado_en, expira_en, revocado_en) FROM stdin;
1	8	ac00646ead66500a4a9e0e8aae02c4eaebfb0c221ad311b48c45d101064dc4de	2026-10-24 17:08:25.523305-05	2026-10-25 01:08:25.523305-05	2026-10-24 17:19:13.918013-05
2	18	e3cf72b5c3d35173fabb800457822a3c02dacd156d4b8f5f278e4c836b3add78	2026-10-24 17:19:31.847254-05	2026-10-25 01:19:31.847254-05	2026-10-24 17:19:53.593442-05
3	19	6bcaed5a24b67f53bcd9584c824795d456215512f4e28e258214b732a10a3dc9	2026-10-24 17:20:08.63599-05	2026-10-25 01:20:08.63599-05	2026-10-24 17:21:16.001235-05
4	8	6164d60b07032072dbf2432aef311b70dec85565ca52151c5844ba710a3919c1	2026-10-24 17:21:23.460117-05	2026-10-25 01:21:23.460117-05	2026-10-24 17:23:33.196852-05
5	23	4b83d23ad86307a8bf3f2cae3ad6330307f26130b8afbf0892a44cf93535d40f	2026-10-24 17:25:18.410623-05	2026-10-25 01:25:18.410623-05	2026-10-24 17:35:46.737343-05
6	24	3fd8b0fd6dbfd1c76b541e6480e8b6198b492fac8e0bae5d6bd6b5fed1af3f8b	2026-10-24 17:50:41.931648-05	2026-10-25 01:50:41.931648-05	2026-10-24 17:54:48.496977-05
7	13	7bee55c4652dd9aa4fca736e516316a2abdf44c69f3bb47302d14eb76b19181e	2026-10-24 17:55:00.696695-05	2026-10-25 01:55:00.696695-05	2026-10-24 17:57:10.447499-05
8	23	445d9b3a2c19612cde849dfcc13194fb8b3307979d3afca13ae5d74d4a13161d	2026-10-24 17:57:19.460235-05	2026-10-25 01:57:19.460235-05	2026-10-24 19:02:03.914442-05
9	13	2de9541a5893a06223886ee26129957a3fa1d708514ca52008f0f699b78b4ec4	2026-10-24 19:02:55.760989-05	2026-10-25 03:02:55.760989-05	2026-10-24 19:35:22.216435-05
11	8	31d16871e34e1badead2bd5086bb7b7af30b3afe3c3f18476738d9460dc905df	2026-10-24 21:33:20.011022-05	2026-10-25 05:33:20.011022-05	2026-10-24 21:34:22.536246-05
12	18	fffed346798fa96b72edf11376e24e0c1be9287b03f8455eafe5af8e1b6c53b2	2026-10-24 21:35:17.125903-05	2026-10-25 05:35:17.125903-05	2026-10-24 21:37:06.576885-05
13	8	8aa35696ec68f7dcb1f20be2fa864a3f67e8e14f031d940591aea2f836b71420	2026-10-24 21:37:20.707182-05	2026-10-25 05:37:20.707182-05	2026-10-24 21:38:08.406353-05
10	24	09b70dbc4f35996cc971c21fdee54d5854b032278d98d299e346d960c3396aa7	2026-10-24 19:38:23.324106-05	2026-10-25 03:38:23.324106-05	2026-10-24 22:03:16.768057-05
14	23	09ca56647548eb1ee4472187c61ea7457ee4909183bf7110e1ccddaabba79f4f	2026-10-24 22:03:34.827407-05	2026-10-25 06:03:34.827407-05	2026-10-24 22:04:43.752223-05
15	18	6b27363339bfb6c3f610d6469281fd42eff27af6dda846b4519a77e179aeb303	2026-10-24 22:04:55.894171-05	2026-10-25 06:04:55.894171-05	2026-10-24 22:05:18.811496-05
16	8	d7122003b70be70c9b608c4e2617223a9e656c6841651de83683a67a43a71e3b	2026-10-25 09:43:49.418126-05	2026-10-25 17:43:49.418126-05	2026-10-25 09:50:45.846843-05
17	23	2e1ec2ab45909519d2f5ad5d96e37f0615813cef681ba2b34b36bdf8aedda6e9	2026-10-25 09:50:59.594184-05	2026-10-25 17:50:59.594184-05	2026-10-25 09:59:44.128724-05
18	13	d9cee4a5d721f8083042d4f507e93cf714035e76892aacf4159b770bd6a8bc45	2026-10-25 09:59:53.243441-05	2026-10-25 17:59:53.243441-05	2026-10-25 10:00:36.757001-05
19	8	9a58aa85e917c6b03fbf71310336538c378890b0fc77c000fd377480223f89cc	2026-10-25 10:01:17.901688-05	2026-10-25 18:01:17.901688-05	\N
\.


--
-- Data for Name: tecnicos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tecnicos (id, usuario_id, nombre, correo, telefono, cuadrante, activo, creado_en, hora_inicio, hora_fin, dias_laborales) FROM stdin;
1	10	Roberto Gómez	roberto.tecnico@empresa.com	3001111111	Norte	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
2	11	Andrea Salazar	andrea.tecnico@empresa.com	3002222222	Sur	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
3	12	Miguel Torres	miguel.tecnico@empresa.com	3003333333	Oriente	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
4	13	Diana Castillo	diana.tecnico@empresa.com	3004444444	Occidente	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
5	14	Jorge Vargas	jorge.tecnico@empresa.com	3005555555	Norte	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
6	15	Laura Mendoza	laura.tecnico@empresa.com	3006666666	Sur	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
7	16	Felipe Rojas	felipe.tecnico@empresa.com	3007777777	Oriente	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
8	17	Camila Rincón	camila.tecnico@empresa.com	3008888888	Occidente	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
9	18	Andrés Ruiz	andres.tecnico@empresa.com	3009999999	Norte	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
10	19	Valentina Castro	valentina.tecnico@empresa.com	3000000000	Sur	t	2026-10-24 17:18:55.679577-05	8	17	{1,2,3,4,5,6}
\.


--
-- Data for Name: tickets_soporte; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets_soporte (id, nombre_completo, identificacion, correo, telefono, tipo_dispositivo, descripcion_problema, estado, fecha_creacion, direccion, canal_origen, categoria, nivel_impacto, es_dano_fisico, intentos_ia, tecnico_asignado_id, fecha_visita, fecha_cierre, url_acta, actualizado_en, usuario_id, prioridad, puntaje_prioridad, motivo_prioridad, fecha_limite_atencion, sla_notificado, acta_sha256) FROM stdin;
3	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-14 09:12:53.576537-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-16 09:12:53.576537-05	t	\N
4	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-14 14:42:42.29977-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-16 14:42:42.29977-05	t	\N
6	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-14 19:36:42.691837-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-16 19:36:42.691837-05	t	\N
10	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Mi porrrtatil, echa Humo	Pendiente	2026-10-15 17:48:32.213791-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:48:32.213791-05	t	\N
20	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 18:00:17.777791-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 18:00:17.777791-05	t	\N
21	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 18:04:16.854769-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 18:04:16.854769-05	t	\N
22	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 18:05:41.667436-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 18:05:41.667436-05	t	\N
23	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 18:06:09.003572-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 18:06:09.003572-05	t	\N
24	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 18:14:01.124072-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 18:14:01.124072-05	t	\N
5	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Escalamiento pendiente	2026-10-14 19:35:39.663425-05	\N	web	Hardware	Alto	t	3	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Alta	3	\N	2026-10-15 19:35:39.663425-05	t	\N
26	From: SANDRA MILENA HOYOS YAYA		sasannmil2016@gmail.com		Computador	No me prende el computador no se que hacer	Pendiente	2026-10-23 12:06:59.24902-05	Bogotá D.C.	email	Hardware	Alto	t	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	8	Alta	3	\N	2026-10-24 12:06:59.24902-05	t	\N
9	Felipe	10256465	julianlondoo14@outlook.com	3208267452	Portatil	Mi portatil echa humo	Pendiente	2026-10-15 17:48:06.74468-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	24	Media	2	\N	2026-10-17 17:48:06.74468-05	t	\N
8	Felipe	10256465	julianlondoo14@outlook.com	3208267452	Portatil	Mi portatil echa humo	Pendiente	2026-10-15 17:47:38.122924-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	24	Media	2	\N	2026-10-17 17:47:38.122924-05	t	\N
7	Julian 	1028782884	Julianlondoo14@outlook.com	3208267452	Portatil	El dispositivo, no da video	Pendiente	2026-10-14 21:22:22.878441-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	24	Media	2	\N	2026-10-16 21:22:22.878441-05	t	\N
2	Julián	1028782884	julianlondoo14@outlook.com	3208267452	Portatil	no enciende mi portatil	Pendiente	2026-10-14 09:11:26.565882-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	24	Media	2	\N	2026-10-16 09:11:26.565882-05	t	\N
30	Lumosity		info@notifications.lumosity.com	\N	Sin especificar	Tu recordatorio de entrenamiento diario\n\nYa sabes lo que significa: ¡es hora de empezar el entrenamiento de hoy! ¿Con qué juegos te divertirás hoy?\n\nLumosity ( https://app.lumosity.com/home?utm_source=customerio&utm_medium=email&utm_campaign=training_reminder&bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ )\n\nStart Your Workout ( https://app.lumosity.com/home?utm_source=customerio&utm_medium=email&utm_campaign=training_reminder&bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ )\n\nHi Milena,\n\nAquí está tu entrenamiento de hoy\n\nLa manera más fácil de ser constante con los entrenamientos es convertirlos en algo rutinario. ¿Listo para entrenar con los juegos de hoy?\n\nEMPEZAR A ENTRENAR ( https://app.lumosity.com/home?utm_source=customerio&utm_medium=email&utm_campaign=training_reminder&bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ )\n\nAceptaste recibir recordatorios de entrenamiento\n\nSiempre puedes cambiar tus preferencias para recibir recordatorios en un momento más conveniente en la sección Notificaciones por correo electrónico de tu configuración ( https://app.lumosity.com/settings/email-notifications?bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ ). Nota: es posible que tengas que iniciar sesión.\n\nPara dejar de recibir recordatorios de capacitación, haz clic aquí ( https://app.lumosity.com/settings/email-notifications?bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ ). Nota: es posible que tengas que iniciar sesión\n\nLumosity ( https://app.lumosity.com/landing?utm_medium=email&utm_source=customerio&utm_campaign=FooterLogo )\n\nFacebook ( https://www.facebook.com/Lumosity/ )\n\nTwitter ( https://twitter.com/lumosity )\n\nInstagram ( https://www.instagram.com/lumosity/ )\n\nAbout ( https://app.lumosity.com/landing?utm_medium=email&utm_source=customerio&utm_campaign=emailfooter )\n\nHelp ( https://lumositybeta.zendesk.com/hc/en-us )\n\nLegal ( https://www.lumosity.com/en/privacy-policy/?utm_medium=email&utm_source=customerio )\n\nUpdate ( https://app.lumosity.com/settings/email-notifications?bt=MTE3MjA4MDAyOm1pbGVuYWhveW9zc3NzQGdtYWlsLmNvbToxNzkyOTI5NjIyOjE3OTM1MzQ0MjI6NTI.oCFCEsA7WUaprZGHrfH1q3iInLfN4HffQSM5yI6HrcQ ) preferences for milenahoyossss@gmail.com or\nunsubscribe ( https://track.customer.io/unsubscribe/dgS6xQwLAO-y3AbustwGAaFy7tRQyAKLnAFIeRraNw== ).\n\n© 2026 Lumos Labs, Inc.   |   16 Maiden Lane, Suite 600, San Francisco, CA 94108	Pendiente	2026-10-25 09:37:50.572254-05	\N	email	\N	\N	\N	0	\N	\N	\N	\N	2026-10-25 09:37:50.572254-05	\N	Baja	1	Consulta o configuración	2026-10-28 09:37:50.572254-05	f	\N
31	Sandra Hoyos Yaya Yaya	1013102514	sasannmil2016@gmail.com	3113122222	Celular	Mi celular no carga, no le sirve ningun cargador	Cerrado	2026-10-25 09:45:02.705673-05	Calle 36 sur #86-25	web	Software	Bajo	f	3	4	2026-10-27 11:00:00-05	2026-10-25 10:01:43.990864-05	ticket-31-a94da05cd74910f52b0f9212.pdf	2026-10-25 10:01:43.990864-05	8	Media	2	Palabra clave: "no carga"	2026-10-27 09:45:02.705673-05	f	f95a876c94fc565f67e33199259106f66da0ad75feccaf997d7b6edb7f57e345
27	Bryan Clark		bryan@neon.tech	\N	Sin especificar	Neon <> Feedback on onboarding (milenahoyossss@gmail.com)\n\nHi there,\n\nMy name is Bryan and I lead the product team at Neon ( https://neon.com ). Thank you for signing up. I wanted to reach out to introduce myself and solicit any feedback good or bad. This is a programmatically sent email but I read every response. We're committed to building the best Postgres experience, and rely on users like you to let us know how things are going.\n\nThanks for choosing Neon, and looking forward to helping!\n\nBest,\nBryan\n\nDon't want to hear from us? Unsubscribe ( https://track.customer.io/unsubscribe/dgT7swoBALiN7QG3je0BAaFvjpr1_ANcMf3cdNVn8A== ) from emails like these.	Pendiente	2026-10-24 16:36:10.922242-05	\N	email	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 21:23:58.010217-05	\N	Media	2	\N	2026-10-26 16:36:10.922242-05	f	\N
29	Julian Ducuara	1013102410	julianlondoo14@outlook.com	3213121000	Celular	Al celular le esta saliendo humo	Cerrado	2026-10-24 17:51:54.361773-05	Calle 36 sur #86-25	web	Hardware	Alto	t	0	4	2026-10-26 08:00:00-05	2026-10-24 19:03:18.908038-05	http://localhost:3000/actas/ticket-29-e138a8635bedd2c1c9402f45.pdf	2026-10-24 21:23:58.010217-05	24	Alta	3	\N	2026-10-25 17:51:54.361773-05	f	\N
28	Sandra Hoyos Yaya Yaya	1013102510	sasannmil2016@gmail.com	3213101320	Computador	No me prende el computador	Cerrado	2026-10-24 17:08:52.685079-05	Calle 36 sur #86-25	web	Software	Bajo	f	3	9	2026-10-31 21:57:00-05	2026-10-24 21:38:04.502905-05	ticket-28-e16b6e605f43439576e7cdbe.pdf	2026-10-24 21:38:04.502905-05	8	Baja	1	\N	2026-10-27 17:08:52.685079-05	f	c09b6d008498f6a2ffb3bf36850f0e85ed5dec14fd7ab94a02de89bdda4e904f
11	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Mi portatil, echa humo	Pendiente	2026-10-15 17:49:50.297875-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:49:50.297875-05	t	\N
12	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Mi portatil, echa humo	Pendiente	2026-10-15 17:49:58.563908-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:49:58.563908-05	t	\N
13	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Mi portatil, echa humo	Pendiente	2026-10-15 17:50:25.356932-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:50:25.356932-05	t	\N
14	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Echa humo	Pendiente	2026-10-15 17:54:42.870276-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:54:42.870276-05	t	\N
15	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	Echa humo	Pendiente	2026-10-15 17:54:48.119889-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:54:48.119889-05	t	\N
16	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-15 17:55:35.520835-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:55:35.520835-05	t	\N
17	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-15 17:56:30.686659-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:56:30.686659-05	t	\N
18	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No enciende	Pendiente	2026-10-15 17:57:03.928115-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:57:03.928115-05	t	\N
19	Julián	1028782884	julianlondoo14@gmail.com	3208267452	Portatil	No sive\n	Pendiente	2026-10-15 17:58:41.884786-05	\N	web	\N	\N	\N	0	\N	\N	\N	\N	2026-10-24 22:00:17.221497-05	\N	Media	2	\N	2026-10-17 17:58:41.884786-05	t	\N
\.


--
-- Data for Name: tokens_recuperacion; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tokens_recuperacion (id, usuario_id, token_hash, creado_en, expira_en, usado_en) FROM stdin;
1	8	ea755bdf4112e21e2fed9a4df0a5fbf3efd1213e19c66e8996a4aec929417500	2026-10-24 17:07:23.420132-05	2026-10-24 17:37:23.420132-05	2026-10-24 17:08:14.720838-05
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, nombre_completo, correo, identificacion, telefono, direccion, rol, password_hash, activo, creado_en, cuadrante, estado, actualizado_en) FROM stdin;
6	Sandra Hoyos Yaya Yaya	milena@gmail.com	1030230233	3213101320	Bogotá D.C.	cliente	\N	t	2026-10-23 11:53:42.261145-05	\N	disponible	2026-10-24 14:37:52.713067-05
8	Sandra Hoyos Yaya Yaya	sasannmil2016@gmail.com	1013102511	3213213211	Bogotá D.C.	cliente	$2a$10$NhnDn0SthTXxZdZvvL6lU.qtxSbZBgiEofhk.uZ5lv6KafYekkZq2	t	2026-10-23 12:06:59.24902-05	\N	disponible	2026-10-24 17:08:14.720838-05
10	Roberto Gómez	roberto.tecnico@empresa.com	1000000001	3001111111	\N	tecnico	$2a$10$pDcIdhB7n.W/owvVdOB82eHoHR4OfNNOwBr1YAzYFYk.av.BofBPO	t	2026-10-23 18:14:15.184281-05	Norte	disponible	2026-10-24 14:37:52.713067-05
11	Andrea Salazar	andrea.tecnico@empresa.com	1000000002	3002222222	\N	tecnico	$2a$10$iO.O5hWXqWH3LfmGwQYxQev9FXo584LxZRt3ot1xuh8JAkQyg.01m	t	2026-10-23 18:14:15.184281-05	Norte	disponible	2026-10-24 14:37:52.713067-05
12	Miguel Torres	miguel.tecnico@empresa.com	1000000003	3003333333	\N	tecnico	$2a$10$YXAmx6ZDtUxmxOTbTDAdQuJacS/rbrmomV7HwmpcnHdEVWitz7vH.	t	2026-10-23 18:14:15.184281-05	Sur	ocupado	2026-10-24 14:37:52.713067-05
13	Diana Castillo	diana.tecnico@empresa.com	1000000004	3004444444	\N	tecnico	$2a$10$/Y08TISNYALSS3rO5Pb9MupSKidUY4Ln28NrDmBnb5pf8DmQnxigm	t	2026-10-23 18:14:15.184281-05	Sur	disponible	2026-10-24 14:37:52.713067-05
14	Jorge Vargas	jorge.tecnico@empresa.com	1000000005	3005555555	\N	tecnico	$2a$10$40qcYyIJKEL1B/EXrmjlguj2BRrOai4VP2JrbfVDh0S7i69QlflSu	t	2026-10-23 18:14:15.184281-05	Sur	disponible	2026-10-24 14:37:52.713067-05
15	Laura Mendoza	laura.tecnico@empresa.com	1000000006	3006666666	\N	tecnico	$2a$10$ju8F9WS9f33cJh9yL4Dw6Omi4fXdqvhjHL.vouuVJr5xApIEwXIW.	t	2026-10-23 18:14:15.184281-05	Oriente	disponible	2026-10-24 14:37:52.713067-05
16	Felipe Rojas	felipe.tecnico@empresa.com	1000000007	3007777777	\N	tecnico	$2a$10$Z0HXkya7ga.glo.8oVzkXeAAiNBqhRonuY/vfOVhq7.mnB4t.zsia	t	2026-10-23 18:14:15.184281-05	Oriente	ocupado	2026-10-24 14:37:52.713067-05
17	Camila Rincón	camila.tecnico@empresa.com	1000000008	3008888888	\N	tecnico	$2a$10$TLQ8RIT4jpag66ViI8lszeeo6r8MJf1j3tZgeHO5wIyegPhWwFpCa	t	2026-10-23 18:14:15.184281-05	Occidente	disponible	2026-10-24 14:37:52.713067-05
18	Andrés Ruiz	andres.tecnico@empresa.com	1000000009	3009999999	\N	tecnico	$2a$10$9AfvaKXu5YxUA01Vk9fV4OfshIXM88fjrHhnw9zRecutQnhFkSyUa	t	2026-10-23 18:14:15.184281-05	Occidente	disponible	2026-10-24 14:37:52.713067-05
19	Valentina Castro	valentina.tecnico@empresa.com	1000000010	3000000000	\N	tecnico	$2a$10$sXCAwwdJjcHAdUpHCaJ1t.xCHsHB2kpoY33M408KAryuhP2VetBDO	t	2026-10-23 18:14:15.184281-05	Occidente	ocupado	2026-10-24 14:37:52.713067-05
23	Administrador Soporte	milenahoyossss@gmail.com	1013102517	3213101321	\N	admin	$2a$10$vaJtWGz3kHlI3XTIN2MrBu2IXFvO22uyq274/lC7uIbAIasn9INze	t	2026-10-24 17:24:13.70652-05	\N	disponible	2026-10-24 17:24:13.70652-05
24	Julian Ducuara	julianlondoo14@outlook.com	1010131411	321321341	\N	cliente	$2a$10$Xm6vQ1D458PzYjHg6ic3YOccypSsWFFVYBT393Gx0AnBCa/s49Ysq	t	2026-10-24 17:50:33.340967-05	\N	disponible	2026-10-24 17:50:33.340967-05
\.


--
-- Data for Name: zonas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zonas (id, nombre, palabras_clave, activo, creado_en) FROM stdin;
1	Norte	norte, suba, usaquen, chapinero, barrios unidos, teusaquillo	t	2026-10-24 21:25:39.546929-05
2	Sur	sur, usme, bosa, ciudad bolivar, tunjuelito, rafael uribe, antonio narino, puente aranda	t	2026-10-24 21:25:39.546929-05
3	Oriente	oriente, san cristobal, candelaria, santa fe, los martires	t	2026-10-24 21:25:39.546929-05
4	Occidente	occidente, engativa, fontibon, kennedy	t	2026-10-24 21:25:39.546929-05
\.


--
-- Name: auditoria_accesos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auditoria_accesos_id_seq', 19, true);


--
-- Name: auditoria_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auditoria_tickets_id_seq', 48, true);


--
-- Name: ausencias_tecnicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ausencias_tecnicos_id_seq', 1, false);


--
-- Name: base_conocimiento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.base_conocimiento_id_seq', 25, true);


--
-- Name: citas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.citas_id_seq', 3, true);


--
-- Name: encuestas_satisfaccion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.encuestas_satisfaccion_id_seq', 2, true);


--
-- Name: historial_chat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.historial_chat_id_seq', 32, true);


--
-- Name: resultados_visita_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resultados_visita_id_seq', 2, true);


--
-- Name: sesiones_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sesiones_usuario_id_seq', 19, true);


--
-- Name: tecnicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tecnicos_id_seq', 10, true);


--
-- Name: tickets_soporte_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tickets_soporte_id_seq', 31, true);


--
-- Name: tokens_recuperacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tokens_recuperacion_id_seq', 1, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 24, true);


--
-- Name: zonas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zonas_id_seq', 8, true);


--
-- Name: auditoria_accesos auditoria_accesos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_accesos
    ADD CONSTRAINT auditoria_accesos_pkey PRIMARY KEY (id);


--
-- Name: auditoria_tickets auditoria_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_tickets
    ADD CONSTRAINT auditoria_tickets_pkey PRIMARY KEY (id);


--
-- Name: ausencias_tecnicos ausencias_tecnicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ausencias_tecnicos
    ADD CONSTRAINT ausencias_tecnicos_pkey PRIMARY KEY (id);


--
-- Name: base_conocimiento base_conocimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.base_conocimiento
    ADD CONSTRAINT base_conocimiento_pkey PRIMARY KEY (id);


--
-- Name: citas citas_estado_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.citas
    ADD CONSTRAINT citas_estado_check CHECK (((estado)::text = ANY ((ARRAY['Agendada'::character varying, 'Realizada'::character varying, 'Cancelada'::character varying, 'Reprogramada'::character varying, 'Completada'::character varying])::text[]))) NOT VALID;


--
-- Name: citas citas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_pkey PRIMARY KEY (id);


--
-- Name: citas citas_tecnico_fecha_unica; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_tecnico_fecha_unica UNIQUE (tecnico_id, fecha_inicio);


--
-- Name: encuestas_satisfaccion encuestas_satisfaccion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encuestas_satisfaccion
    ADD CONSTRAINT encuestas_satisfaccion_pkey PRIMARY KEY (id);


--
-- Name: historial_chat historial_chat_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_chat
    ADD CONSTRAINT historial_chat_pkey PRIMARY KEY (id);


--
-- Name: resultados_visita resultados_visita_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados_visita
    ADD CONSTRAINT resultados_visita_pkey PRIMARY KEY (id);


--
-- Name: sesiones_usuario sesiones_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_usuario
    ADD CONSTRAINT sesiones_usuario_pkey PRIMARY KEY (id);


--
-- Name: sesiones_usuario sesiones_usuario_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_usuario
    ADD CONSTRAINT sesiones_usuario_token_hash_key UNIQUE (token_hash);


--
-- Name: tecnicos tecnicos_correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos
    ADD CONSTRAINT tecnicos_correo_key UNIQUE (correo);


--
-- Name: tecnicos tecnicos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos
    ADD CONSTRAINT tecnicos_pkey PRIMARY KEY (id);


--
-- Name: tecnicos tecnicos_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos
    ADD CONSTRAINT tecnicos_usuario_id_key UNIQUE (usuario_id);


--
-- Name: tickets_soporte tickets_soporte_canal_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_canal_check CHECK (((canal_origen)::text = ANY ((ARRAY['web'::character varying, 'chat'::character varying, 'email'::character varying])::text[]))) NOT VALID;


--
-- Name: tickets_soporte tickets_soporte_estado_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_estado_check CHECK (((estado)::text = ANY ((ARRAY['Pendiente'::character varying, 'En diagnóstico'::character varying, 'Resuelto IA'::character varying, 'Escalamiento pendiente'::character varying, 'Escalado nivel 2'::character varying, 'Pendiente de asignación'::character varying, 'Agendado'::character varying, 'En atención'::character varying, 'Pendiente de confirmación'::character varying, 'Cerrado'::character varying, 'Cancelado'::character varying])::text[]))) NOT VALID;


--
-- Name: tickets_soporte tickets_soporte_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_pkey PRIMARY KEY (id);


--
-- Name: tokens_recuperacion tokens_recuperacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_pkey PRIMARY KEY (id);


--
-- Name: tokens_recuperacion tokens_recuperacion_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_token_hash_key UNIQUE (token_hash);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_rol_check; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['cliente'::character varying, 'tecnico'::character varying, 'admin'::character varying])::text[]))) NOT VALID;


--
-- Name: zonas zonas_nombre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zonas
    ADD CONSTRAINT zonas_nombre_key UNIQUE (nombre);


--
-- Name: zonas zonas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zonas
    ADD CONSTRAINT zonas_pkey PRIMARY KEY (id);


--
-- Name: accesos_correo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accesos_correo_idx ON public.auditoria_accesos USING btree (lower((correo)::text), creado_en DESC);


--
-- Name: accesos_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accesos_fecha_idx ON public.auditoria_accesos USING btree (creado_en DESC);


--
-- Name: auditoria_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auditoria_ticket_idx ON public.auditoria_tickets USING btree (ticket_id, creado_en);


--
-- Name: ausencias_tecnico_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ausencias_tecnico_idx ON public.ausencias_tecnicos USING btree (tecnico_id, desde, hasta);


--
-- Name: base_conocimiento_fts_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX base_conocimiento_fts_idx ON public.base_conocimiento USING gin (to_tsvector('spanish'::regconfig, (((titulo)::text || ' '::text) || contenido)));


--
-- Name: citas_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX citas_fecha_idx ON public.citas USING btree (fecha_inicio);


--
-- Name: citas_tecnico_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX citas_tecnico_fecha_idx ON public.citas USING btree (tecnico_id, fecha_inicio) WHERE ((estado)::text = 'Agendada'::text);


--
-- Name: citas_ticket_agendada_uk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX citas_ticket_agendada_uk ON public.citas USING btree (ticket_id) WHERE ((estado)::text = 'Agendada'::text);


--
-- Name: encuestas_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX encuestas_fecha_idx ON public.encuestas_satisfaccion USING btree (creado_en);


--
-- Name: encuestas_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX encuestas_ticket_idx ON public.encuestas_satisfaccion USING btree (ticket_id);


--
-- Name: historial_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX historial_ticket_idx ON public.historial_chat USING btree (ticket_id, fecha_mensaje);


--
-- Name: idx_citas_fecha_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_citas_fecha_estado ON public.citas USING btree (fecha_inicio, estado);


--
-- Name: idx_historial_ticket_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historial_ticket_fecha ON public.historial_chat USING btree (ticket_id, fecha_mensaje);


--
-- Name: idx_tecnicos_cuadrante_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tecnicos_cuadrante_activo ON public.tecnicos USING btree (cuadrante, activo);


--
-- Name: idx_tickets_estado_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_estado_fecha ON public.tickets_soporte USING btree (estado, fecha_creacion DESC);


--
-- Name: resultados_ticket_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX resultados_ticket_idx ON public.resultados_visita USING btree (ticket_id, creado_en DESC);


--
-- Name: sesiones_expira_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sesiones_expira_idx ON public.sesiones_usuario USING btree (expira_en);


--
-- Name: sesiones_usuario_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sesiones_usuario_idx ON public.sesiones_usuario USING btree (usuario_id);


--
-- Name: tecnicos_usuario_uk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tecnicos_usuario_uk ON public.tecnicos USING btree (usuario_id) WHERE (usuario_id IS NOT NULL);


--
-- Name: tickets_abiertos_sla_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_abiertos_sla_idx ON public.tickets_soporte USING btree (puntaje_prioridad DESC, fecha_limite_atencion) WHERE ((estado)::text <> ALL ((ARRAY['Cerrado'::character varying, 'Cancelado'::character varying, 'Resuelto IA'::character varying])::text[]));


--
-- Name: tickets_cierre_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_cierre_idx ON public.tickets_soporte USING btree (fecha_cierre) WHERE (fecha_cierre IS NOT NULL);


--
-- Name: tickets_correo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_correo_idx ON public.tickets_soporte USING btree (lower((correo)::text));


--
-- Name: tickets_estado_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_estado_idx ON public.tickets_soporte USING btree (estado);


--
-- Name: tickets_fecha_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_fecha_idx ON public.tickets_soporte USING btree (fecha_creacion DESC);


--
-- Name: tickets_tecnico_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_tecnico_idx ON public.tickets_soporte USING btree (tecnico_asignado_id);


--
-- Name: tickets_usuario_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tickets_usuario_idx ON public.tickets_soporte USING btree (usuario_id);


--
-- Name: usuarios_correo_lower_uk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_correo_lower_uk ON public.usuarios USING btree (lower((correo)::text));


--
-- Name: tickets_soporte tickets_actualizado_en; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tickets_actualizado_en BEFORE UPDATE ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();


--
-- Name: tickets_soporte tickets_auditar_estado; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE CONSTRAINT TRIGGER tickets_auditar_estado AFTER UPDATE OF estado ON public.tickets_soporte DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((old.estado)::text IS DISTINCT FROM (new.estado)::text)) EXECUTE FUNCTION public.auditar_cambio_estado();


--
-- Name: tickets_soporte trg_auditar_estado_ticket; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_auditar_estado_ticket BEFORE UPDATE ON public.tickets_soporte FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_estado_ticket();


--
-- Name: auditoria_accesos auditoria_accesos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_accesos
    ADD CONSTRAINT auditoria_accesos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: auditoria_tickets auditoria_tickets_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_tickets
    ADD CONSTRAINT auditoria_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id);


--
-- Name: ausencias_tecnicos ausencias_tecnicos_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ausencias_tecnicos
    ADD CONSTRAINT ausencias_tecnicos_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.tecnicos(id) ON DELETE CASCADE;


--
-- Name: citas citas_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.tecnicos(id);


--
-- Name: citas citas_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.citas
    ADD CONSTRAINT citas_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id);


--
-- Name: encuestas_satisfaccion encuestas_satisfaccion_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encuestas_satisfaccion
    ADD CONSTRAINT encuestas_satisfaccion_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id);


--
-- Name: encuestas_satisfaccion encuestas_satisfaccion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encuestas_satisfaccion
    ADD CONSTRAINT encuestas_satisfaccion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: historial_chat fk_ticket_historial; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historial_chat
    ADD CONSTRAINT fk_ticket_historial FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id) ON DELETE CASCADE;


--
-- Name: tickets_soporte fk_tickets_tecnico; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT fk_tickets_tecnico FOREIGN KEY (tecnico_asignado_id) REFERENCES public.tecnicos(id) NOT VALID;


--
-- Name: resultados_visita resultados_visita_cita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados_visita
    ADD CONSTRAINT resultados_visita_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id);


--
-- Name: resultados_visita resultados_visita_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados_visita
    ADD CONSTRAINT resultados_visita_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.tecnicos(id);


--
-- Name: resultados_visita resultados_visita_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resultados_visita
    ADD CONSTRAINT resultados_visita_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets_soporte(id);


--
-- Name: sesiones_usuario sesiones_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sesiones_usuario
    ADD CONSTRAINT sesiones_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: tecnicos tecnicos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos
    ADD CONSTRAINT tecnicos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: tecnicos tecnicos_zona_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tecnicos
    ADD CONSTRAINT tecnicos_zona_fk FOREIGN KEY (cuadrante) REFERENCES public.zonas(nombre) ON UPDATE CASCADE;


--
-- Name: tickets_soporte tickets_soporte_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets_soporte
    ADD CONSTRAINT tickets_soporte_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: tokens_recuperacion tokens_recuperacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_recuperacion
    ADD CONSTRAINT tokens_recuperacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict RpQDqtIuQQaO5oaeR9kfZNY0KIWSZ1RvFdjm1syBU9uOlHfUEwmkmUkIxPoH2Rb

