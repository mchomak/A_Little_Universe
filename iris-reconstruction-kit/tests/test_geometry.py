import numpy as np
import pytest
from iris_baker.geometry import Ellipse,polar_remap,validate_geometry
from iris_baker.particles import srgb_to_linear


def test_rubber_sheet_edge_points():
    pupil=Ellipse(100,100,25,20)
    iris=Ellipse(104,102,60,55)
    mx,my=polar_remap(pupil,iris,400,40)
    assert mx.shape==(40,400)
    assert abs(mx[0,0]-125)<1e-4
    assert abs(mx[-1,0]-164)<1e-4
    validate_geometry(pupil,iris,240,240)


def test_invalid_pupil_outside():
    with pytest.raises(ValueError):
        validate_geometry(Ellipse(40,40,26,26),Ellipse(55,55,35,35),110,110)


def test_srgb_transfer():
    a=srgb_to_linear(np.array([0.,.5,1.]))
    np.testing.assert_allclose(a,[0,.21404114,1],atol=1e-5)
