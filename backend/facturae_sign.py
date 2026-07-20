"""Firma XAdES-EPES de facturas Facturae 3.2.2 (formato exigido por FACe).

Usa la librería `xades`/`xmlsig`. La política de firma de Facturae se declara con
su digest oficial fijo para no depender de la descarga del PDF de política.
"""
import base64
import xmlsig
import xades
from lxml import etree
from cryptography.hazmat.primitives.serialization import pkcs12

# Política de firma oficial de Facturae v3.1 (digest SHA-1 en base64 publicado por la AEAT)
FACTURAE_POLICY_ID = (
    "http://www.facturae.es/politica_de_firma_formato_facturae/"
    "politica_de_firma_formato_facturae_v3_1.pdf"
)
FACTURAE_POLICY_NAME = (
    "Política de Firma FacturaE v3.1"
)
FACTURAE_POLICY_DIGEST_SHA1 = "Ohixl6upD6av8N7pEvDABhEL6hM="

ETSI = xades.ns.EtsiNS
DS = xmlsig.constants.DSigNs


class FacturaePolicy(xades.policy.GenericPolicyId):
    """Política de firma Facturae con digest fijo (sin descargar el PDF)."""

    def __init__(self):
        super().__init__(FACTURAE_POLICY_ID, FACTURAE_POLICY_NAME,
                         xmlsig.constants.TransformSha1)

    def produce_policy_node(self, node):
        from lxml.builder import ElementMaker
        E = ElementMaker(namespace=ETSI, nsmap={"etsi": ETSI})
        DSE = ElementMaker(namespace=DS, nsmap={"ds": DS})
        node.append(
            E.SignaturePolicyId(
                E.SigPolicyId(
                    E.Identifier(self.identifier),
                    E.Description(self.name),
                ),
                E.SigPolicyHash(
                    DSE.DigestMethod(Algorithm=xmlsig.constants.TransformSha1),
                    DSE.DigestValue(FACTURAE_POLICY_DIGEST_SHA1),
                ),
            )
        )


def firmar_facturae(xml_bytes: bytes, p12_bytes: bytes, password: str) -> bytes:
    """Devuelve el XML Facturae firmado (XAdES-EPES enveloped) en bytes (.xsig)."""
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")
    root = etree.fromstring(xml_bytes)

    sid = "Signature"
    sig = xmlsig.template.create(
        xmlsig.constants.TransformInclC14N,
        xmlsig.constants.TransformRsaSha256,
        sid,
    )
    ref = xmlsig.template.add_reference(sig, xmlsig.constants.TransformSha256, uri="")
    xmlsig.template.add_transform(ref, xmlsig.constants.TransformEnveloped)
    xmlsig.template.add_reference(
        sig, xmlsig.constants.TransformSha256,
        uri="#" + sid + "-signedprops",
        uri_type="http://uri.etsi.org/01903#SignedProperties",
    )
    ki = xmlsig.template.ensure_key_info(sig)
    x509 = xmlsig.template.add_x509_data(ki)
    xmlsig.template.x509_data_add_certificate(x509)
    xmlsig.template.add_key_value(ki)
    root.append(sig)

    qp = xades.template.create_qualifying_properties(sig)
    xades.template.create_signed_properties(qp, name=sid + "-signedprops")

    ctx = xades.XAdESContext(FacturaePolicy())
    ctx.load_pkcs12(pkcs12.load_key_and_certificates(p12_bytes, password.encode()))
    ctx.sign(sig)
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")


def leer_datos_certificado(p12_bytes: bytes, password: str) -> dict:
    """Valida la contraseña y devuelve datos básicos del certificado (CN, validez)."""
    key, cert, _ = pkcs12.load_key_and_certificates(p12_bytes, password.encode())
    if cert is None:
        raise ValueError("El fichero no contiene un certificado válido")
    cn = ""
    try:
        from cryptography.x509.oid import NameOID
        attrs = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        cn = attrs[0].value if attrs else cert.subject.rfc4514_string()
    except Exception:
        cn = cert.subject.rfc4514_string()
    return {
        "titular": cn,
        "valido_desde": cert.not_valid_before_utc.date().isoformat(),
        "valido_hasta": cert.not_valid_after_utc.date().isoformat(),
        "emisor": cert.issuer.rfc4514_string(),
    }
